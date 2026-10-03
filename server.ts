import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const app = express();
// The dev server and backend proxy must always bind to port 3000.
// Cloud Run sets PORT=8080 which is occupied by the frontend reverse proxy (nginx).
const port = 3000;
const isProd = process.env.NODE_ENV === 'production';

// Ensure SQLite database directory exists
const dataDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'database.sqlite');
const db = new DatabaseSync(dbPath);

// Initialize database schema - NO PROGRAM DATA SEEDING
// All tables start completely empty. Everything is saved and retrieved in database.
db.exec(`
  CREATE TABLE IF NOT EXISTS assessments (
    id TEXT PRIMARY KEY,
    title TEXT,
    subject TEXT,
    grade TEXT,
    data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    subject TEXT,
    domain TEXT,
    chapter TEXT,
    lesson TEXT,
    topic TEXT,
    difficulty TEXT,
    estimated_seconds INTEGER,
    target_exam TEXT,
    question_type TEXT,
    data TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS curriculum_taxonomy (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS attempts (
    id TEXT PRIMARY KEY,
    assessment_id TEXT,
    student_name TEXT,
    student_email TEXT,
    status TEXT,
    data TEXT NOT NULL,
    report_data TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS survey_questions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS action_plans (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS survey_responses (
    id TEXT PRIMARY KEY,
    attempt_id TEXT,
    student_email TEXT,
    data TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT
  );
`);

// Run robust SQLite column migrations and backfill existing question records
function ensureQuestionsSchemaAndBackfill() {
  try {
    const tableInfo = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>;
    const existingCols = new Set(tableInfo.map((c) => c.name));

    const columnsToAdd: Array<{ name: string; type: string; defaultVal: string }> = [
      { name: 'subject', type: 'TEXT', defaultVal: "'Mathematics'" },
      { name: 'domain', type: 'TEXT', defaultVal: "'Algebra & Functions'" },
      { name: 'chapter', type: 'TEXT', defaultVal: "'Linear Equations & Systems'" },
      { name: 'lesson', type: 'TEXT', defaultVal: "'Single-Variable Linear Equations'" },
      { name: 'topic', type: 'TEXT', defaultVal: "'Linear Equations & Systems'" },
      { name: 'difficulty', type: 'TEXT', defaultVal: "'medium'" },
      { name: 'estimated_seconds', type: 'INTEGER', defaultVal: '90' },
      { name: 'target_exam', type: 'TEXT', defaultVal: "'EST 1 / SAT Math'" },
      { name: 'question_type', type: 'TEXT', defaultVal: "'multiple_choice'" },
    ];

    for (const col of columnsToAdd) {
      if (!existingCols.has(col.name)) {
        console.log(`[Database Migration] Adding missing column '${col.name}' to 'questions' table`);
        db.exec(`ALTER TABLE questions ADD COLUMN ${col.name} ${col.type} DEFAULT ${col.defaultVal};`);
      }
    }

    // Backfill all existing rows to eliminate ANY nulls or blank fields in database columns and JSON blob
    const rows = db.prepare('SELECT id, data FROM questions').all() as Array<{ id: string; data: string }>;
    const updateStmt = db.prepare(`
      UPDATE questions
      SET
        subject = ?,
        domain = ?,
        chapter = ?,
        lesson = ?,
        topic = ?,
        difficulty = ?,
        estimated_seconds = ?,
        target_exam = ?,
        question_type = ?,
        data = ?,
        updated_at = ?
      WHERE id = ?
    `);

    let backfilledCount = 0;
    for (const row of rows) {
      if (!row.data) continue;
      try {
        const q = JSON.parse(row.data);
        const domain = (q.domain || '').trim();
        const chapter = (q.chapter || q.topic || '').trim();
        const lesson = (q.lesson || '').trim();
        const topic = (q.topic || chapter).trim() || chapter;
        const subject = (q.subject || 'Mathematics').trim() || 'Mathematics';
        const difficulty = (q.difficulty || 'medium').trim() || 'medium';
        const estimatedSeconds = Math.max(10, Number(q.estimatedSeconds ?? q.estimated_seconds) || 90);
        const targetExam = (q.targetExam || q.target_exam || 'EST 1 / SAT Math').trim() || 'EST 1 / SAT Math';
        const questionType = (q.questionType || q.question_type || 'multiple_choice').trim() || 'multiple_choice';
        const now = new Date().toISOString();

        q.id = row.id;
        q.subject = subject;
        q.domain = domain;
        q.chapter = chapter;
        q.lesson = lesson;
        q.topic = topic;
        q.difficulty = difficulty;
        q.estimatedSeconds = estimatedSeconds;
        q.targetExam = targetExam;
        q.questionType = questionType;

        updateStmt.run(
          subject,
          domain,
          chapter,
          lesson,
          topic,
          difficulty,
          estimatedSeconds,
          targetExam,
          questionType,
          JSON.stringify(q),
          q.updatedAt || now,
          row.id
        );
        backfilledCount++;
      } catch (parseErr) {
        console.warn(`[Database Migration] Warning parsing row ${row.id}:`, parseErr);
      }
    }
    console.log(`[Database Migration] Questions table verified and ${backfilledCount} row(s) checked/backfilled with zero nulls.`);
  } catch (migErr) {
    console.error('[Database Migration] Error verifying questions schema:', migErr);
  }
}
ensureQuestionsSchemaAndBackfill();

// -----------------------------------------------------------------------------
// Unit of Work Engine: Transactional integrity for all multi-step & atomic operations
// -----------------------------------------------------------------------------
let _activeTxDepth = 0;

export function runInUnitOfWork<T>(work: () => T): T {
  if (_activeTxDepth > 0) {
    const spName = `uow_sp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.exec(`SAVEPOINT ${spName}`);
    try {
      _activeTxDepth++;
      const res = work();
      db.exec(`RELEASE SAVEPOINT ${spName}`);
      return res;
    } catch (err) {
      db.exec(`ROLLBACK TO SAVEPOINT ${spName}`);
      throw err;
    } finally {
      _activeTxDepth--;
    }
  }

  _activeTxDepth = 1;
  db.exec('BEGIN IMMEDIATE');
  try {
    const res = work();
    db.exec('COMMIT');
    return res;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch (rbErr) {
      console.error('[UnitOfWork] Rollback error:', rbErr);
    }
    throw err;
  } finally {
    _activeTxDepth = 0;
  }
}

function internalSaveQuestionsInUow(items: any[], now = new Date().toISOString()): { count: number; savedIds: string[] } {
  const qStmt = db.prepare(`
    INSERT INTO questions (
      id, subject, domain, chapter, lesson, topic, difficulty, estimated_seconds, target_exam, question_type, data, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      subject = excluded.subject,
      domain = excluded.domain,
      chapter = excluded.chapter,
      lesson = excluded.lesson,
      topic = excluded.topic,
      difficulty = excluded.difficulty,
      estimated_seconds = excluded.estimated_seconds,
      target_exam = excluded.target_exam,
      question_type = excluded.question_type,
      data = excluded.data,
      updated_at = excluded.updated_at
  `);

  // Load current taxonomy for atomic integration
  const taxRow = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
  let tax: Record<string, any> = {};
  if (taxRow && taxRow.data) {
    try { tax = JSON.parse(taxRow.data) || {}; } catch {}
  }
  let taxChanged = false;

  // Track affected collections for atomic count updates
  const affectedCollections = new Set<string>();
  const savedIds: string[] = [];

  for (let i = 0; i < items.length; i++) {
    const q = items[i];
    if (!q || typeof q !== 'object') continue;

    const prompt = (q.prompt || q.stem || q.question || q.text || '').toString().trim();
    if (!prompt) {
      throw new Error(`Question ${q.id ? `"${q.id}"` : `#${i + 1}`} is missing mandatory 'prompt' stem.`);
    }

    const qId = q.id ? String(q.id).trim() : `qb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    q.id = qId;

    const domain = (q.domain ? String(q.domain) : '').trim();
    const chapter = (q.chapter ? String(q.chapter) : '').trim();
    const lesson = (q.lesson ? String(q.lesson) : '').trim();
    const topic = (q.topic ? String(q.topic) : chapter || '').trim();
    const subject = (q.subject ? String(q.subject) : 'Mathematics').trim();
    const difficulty = (q.difficulty ? String(q.difficulty) : 'medium').trim();
    const estSec = Math.max(10, Number(q.estimatedSeconds ?? q.estimated_seconds) || 90);
    const targetExam = (q.targetExam || q.target_exam || 'EST 1 / SAT Math').toString().trim();
    const questionType = (q.questionType || q.question_type || 'multiple_choice').toString().trim();
    const collectionName = (q.collection ? String(q.collection) : 'General Question Bank').trim();

    // Ensure taxonomy integration in same Unit of Work
    if (domain) {
      if (!tax[domain]) {
        tax[domain] = {
          unitLabel: `Unit: ${domain}`,
          code: domain.substring(0, 3).toUpperCase(),
          chapters: [],
        };
        taxChanged = true;
      }
      if (chapter) {
        let chapObj = tax[domain].chapters.find((c: any) => (c.name || '').trim().toLowerCase() === chapter.toLowerCase());
        if (!chapObj) {
          chapObj = {
            name: chapter,
            code: `${tax[domain].code || 'CH'}.${tax[domain].chapters.length + 1}`,
            lessons: [],
          };
          tax[domain].chapters.push(chapObj);
          taxChanged = true;
        }
        if (lesson) {
          if (!chapObj.lessons.some((l: string) => l.trim().toLowerCase() === lesson.toLowerCase())) {
            chapObj.lessons.push(lesson);
            taxChanged = true;
          }
        }
      }
    }

    // Keep JSON data strictly aligned with database columns
    q.domain = domain;
    q.chapter = chapter;
    q.lesson = lesson;
    q.topic = topic;
    q.subject = subject;
    q.difficulty = difficulty;
    q.estimatedSeconds = estSec;
    q.targetExam = targetExam;
    q.questionType = questionType;
    q.collection = collectionName;
    q.updatedAt = now;
    if (!q.createdAt) q.createdAt = now;

    qStmt.run(
      qId,
      subject,
      domain,
      chapter,
      lesson,
      topic,
      difficulty,
      estSec,
      targetExam,
      questionType,
      JSON.stringify(q),
      q.createdAt || now,
      now
    );

    savedIds.push(qId);
    affectedCollections.add(collectionName);
  }

  // Atomically update curriculum_taxonomy if new domains/chapters/lessons were added
  if (taxChanged) {
    db.prepare(`
      INSERT INTO curriculum_taxonomy (id, data, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
    `).run('curriculum_taxonomy', JSON.stringify(tax), now);
  }

  // Atomically recalculate and update affected collections
  const colStmt = db.prepare(`
    INSERT INTO collections (id, name, data, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      data = excluded.data,
      updated_at = excluded.updated_at
  `);

  for (const colName of affectedCollections) {
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM questions WHERE json_extract(data, '$.collection') = ?").get(colName) as { cnt: number } | undefined;
    const qCount = countRow ? countRow.cnt : 0;

    const existingColRow = db.prepare('SELECT data FROM collections WHERE id = ? OR name = ?').get(colName, colName) as { data: string } | undefined;
    let colData: any = {
      id: colName,
      name: colName,
      description: `Collection for ${colName}`,
      targetExam: 'EST 1 / SAT Math',
      questionCount: qCount,
      createdAt: now,
      updatedAt: now,
    };
    if (existingColRow && existingColRow.data) {
      try {
        colData = JSON.parse(existingColRow.data);
        colData.questionCount = qCount;
        colData.updatedAt = now;
      } catch {}
    } else {
      colData.questionCount = qCount;
    }

    colStmt.run(colData.id || colName, colName, JSON.stringify(colData), now);
  }

  return { count: savedIds.length, savedIds };
}

function internalDeleteQuestionsInUow(ids: string[]): { deletedCount: number } {
  if (ids.length === 0) return { deletedCount: 0 };

  const affectedCols = new Set<string>();
  const findStmt = db.prepare("SELECT json_extract(data, '$.collection') as col FROM questions WHERE id = ?");
  for (const id of ids) {
    const row = findStmt.get(id) as { col: string | null } | undefined;
    if (row && row.col) affectedCols.add(row.col);
  }

  const delStmt = db.prepare('DELETE FROM questions WHERE id = ?');
  let deletedCount = 0;
  for (const id of ids) {
    delStmt.run(id);
    deletedCount++;
  }

  // Atomically update affected collections counts
  const now = new Date().toISOString();
  const updateColStmt = db.prepare('UPDATE collections SET data = ?, updated_at = ? WHERE id = ? OR name = ?');
  for (const colName of affectedCols) {
    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM questions WHERE json_extract(data, '$.collection') = ?").get(colName) as { cnt: number } | undefined;
    const qCount = countRow ? countRow.cnt : 0;
    const colRow = db.prepare('SELECT data FROM collections WHERE id = ? OR name = ?').get(colName, colName) as { data: string } | undefined;
    if (colRow && colRow.data) {
      try {
        const parsed = JSON.parse(colRow.data);
        parsed.questionCount = qCount;
        parsed.updatedAt = now;
        updateColStmt.run(JSON.stringify(parsed), now, colName, colName);
      } catch {}
    }
  }

  return { deletedCount };
}

function internalDeleteAssessmentInUow(assessmentId: string): void {
  // 1. Delete survey responses linked to any attempt of this assessment
  db.prepare(`
    DELETE FROM survey_responses 
    WHERE attempt_id IN (SELECT id FROM attempts WHERE assessment_id = ?)
  `).run(assessmentId);

  // 2. Delete attempts linked to this assessment
  db.prepare('DELETE FROM attempts WHERE assessment_id = ?').run(assessmentId);

  // 3. Delete the assessment itself
  db.prepare('DELETE FROM assessments WHERE id = ?').run(assessmentId);
}

function internalDeleteAttemptInUow(attemptId: string): void {
  db.prepare('DELETE FROM survey_responses WHERE attempt_id = ?').run(attemptId);
  db.prepare('DELETE FROM attempts WHERE id = ?').run(attemptId);
}

// -----------------------------------------------------------------------------
// Database tables start empty - only user-saved data in database is returned
// -----------------------------------------------------------------------------
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -----------------------------------------------------------------------------
// REST API: Assessments
// -----------------------------------------------------------------------------
app.get('/api/assessments', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM assessments ORDER BY updated_at DESC').all() as Array<{ data: string }>;
    const list = rows.map((r) => JSON.parse(r.data));
    res.json(list);
  } catch (err: any) {
    console.error('Error fetching assessments:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/assessments/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM assessments WHERE id = ?').get(req.params.id) as { data: string } | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    res.json(JSON.parse(row.data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/assessments', (req: Request, res: Response) => {
  try {
    const assessment = req.body;
    if (!assessment || !assessment.id) {
      return res.status(400).json({ error: 'Invalid assessment data: id is required' });
    }
    const now = new Date().toISOString();
    const createdAt = assessment.createdAt || now;
    const updatedAt = assessment.updatedAt || now;

    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO assessments (id, title, subject, grade, data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          subject = excluded.subject,
          grade = excluded.grade,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);

      stmt.run(
        assessment.id,
        assessment.title || '',
        assessment.subject || '',
        assessment.grade || '',
        JSON.stringify(assessment),
        createdAt,
        updatedAt
      );
    });

    res.json({ success: true, assessment });
  } catch (err: any) {
    console.error('Error saving assessment in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/assessments/:id', (req: Request, res: Response) => {
  try {
    runInUnitOfWork(() => {
      internalDeleteAssessmentInUow(req.params.id);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting assessment in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Questions
// -----------------------------------------------------------------------------
app.get('/api/questions', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare(`
      SELECT 
        id, subject, domain, chapter, lesson, topic, difficulty, 
        estimated_seconds, target_exam, question_type, data, created_at, updated_at 
      FROM questions 
      ORDER BY updated_at DESC
    `).all() as Array<any>;

    const list = rows.map((r) => {
      let parsed: any = {};
      try {
        parsed = JSON.parse(r.data);
      } catch {
        parsed = {};
      }
      return {
        ...parsed,
        id: r.id,
        subject: r.subject || parsed.subject || 'Mathematics',
        domain: (r.domain || parsed.domain || '').trim(),
        chapter: (r.chapter || parsed.chapter || '').trim(),
        lesson: (r.lesson || parsed.lesson || '').trim(),
        topic: (r.topic || parsed.topic || r.chapter || '').trim(),
        difficulty: r.difficulty || parsed.difficulty || 'medium',
        estimatedSeconds: r.estimated_seconds ?? parsed.estimatedSeconds ?? 90,
        targetExam: r.target_exam || parsed.targetExam || 'EST 1 / SAT Math',
        questionType: r.question_type || parsed.questionType || 'multiple_choice',
        createdAt: r.created_at || parsed.createdAt,
        updatedAt: r.updated_at || parsed.updatedAt,
      };
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/questions/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare(`
      SELECT 
        id, subject, domain, chapter, lesson, topic, difficulty, 
        estimated_seconds, target_exam, question_type, data, created_at, updated_at 
      FROM questions 
      WHERE id = ?
    `).get(req.params.id) as any;

    if (!row) return res.status(404).json({ error: 'Question not found' });
    let parsed: any = {};
    try {
      parsed = JSON.parse(row.data);
    } catch {
      parsed = {};
    }
    const item = {
      ...parsed,
      id: row.id,
      subject: row.subject || parsed.subject || 'Mathematics',
      domain: (row.domain || parsed.domain || '').trim(),
      chapter: (row.chapter || parsed.chapter || '').trim(),
      lesson: (row.lesson || parsed.lesson || '').trim(),
      topic: (row.topic || parsed.topic || row.chapter || '').trim(),
      difficulty: row.difficulty || parsed.difficulty || 'medium',
      estimatedSeconds: row.estimated_seconds ?? parsed.estimatedSeconds ?? 90,
      targetExam: row.target_exam || parsed.targetExam || 'EST 1 / SAT Math',
      questionType: row.question_type || parsed.questionType || 'multiple_choice',
      createdAt: row.created_at || parsed.createdAt,
      updatedAt: row.updated_at || parsed.updatedAt,
    };
    res.json(item);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];

    if (items.length === 0) {
      return res.status(400).json({ error: 'No question data provided in request body' });
    }

    const result = runInUnitOfWork(() => {
      return internalSaveQuestionsInUow(items);
    });

    console.log(`[Database] Successfully saved ${result.count} question(s) in Unit of Work`);
    res.json({ success: true, count: result.count, ids: result.savedIds });
  } catch (err: any) {
    console.error('[Database] Error saving questions in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/questions/:id', (req: Request, res: Response) => {
  try {
    const qId = req.params.id;
    runInUnitOfWork(() => {
      internalDeleteQuestionsInUow([qId]);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Database] Error deleting question in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/questions/batch-delete', (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (Array.isArray(ids) && ids.length > 0) {
      runInUnitOfWork(() => {
        internalDeleteQuestionsInUow(ids);
      });
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Database] Error batch-deleting questions in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/questions', (_req: Request, res: Response) => {
  try {
    runInUnitOfWork(() => {
      db.prepare('DELETE FROM questions').run();
      // Also reset questionCount in all collections
      const collectionsRows = db.prepare('SELECT id, name, data FROM collections').all() as Array<{ id: string; name: string; data: string }>;
      const now = new Date().toISOString();
      const updateColStmt = db.prepare('UPDATE collections SET data = ?, updated_at = ? WHERE id = ?');
      for (const row of collectionsRows) {
        try {
          const parsed = JSON.parse(row.data);
          parsed.questionCount = 0;
          updateColStmt.run(JSON.stringify(parsed), now, row.id);
        } catch {}
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Database] Error wiping questions in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Collections & Taxonomy
// -----------------------------------------------------------------------------
app.get('/api/collections', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM collections ORDER BY updated_at DESC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];
    const now = new Date().toISOString();

    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO collections (id, name, data, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          data = excluded.data,
          updated_at = excluded.updated_at
      `);

      for (const c of items) {
        if (!c || !c.name) continue;
        const colId = c.id || c.name;
        stmt.run(colId, c.name, JSON.stringify(c), now);
      }
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Collections] Error saving collections in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/collections/:id', (req: Request, res: Response) => {
  try {
    runInUnitOfWork(() => {
      db.prepare('DELETE FROM collections WHERE id = ? OR name = ?').run(req.params.id, req.params.id);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Collections] Error deleting collection in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/taxonomy', (_req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
    let tax: Record<string, any> = {};
    if (row && row.data) {
      try {
        tax = JSON.parse(row.data) || {};
      } catch {
        tax = {};
      }
      // Return accurate stored taxonomy directly from database
      return res.json(tax);
    }

    // Only if curriculum_taxonomy has never been initialized, bootstrap initial taxonomy
    try {
      const qRows = db.prepare('SELECT domain, chapter, lesson, topic FROM questions').all() as Array<{
        domain: string | null;
        chapter: string | null;
        lesson: string | null;
        topic: string | null;
      }>;

      for (const q of qRows) {
        const d = (q.domain || '').trim();
        if (!d || d.toLowerCase() === 'unassigned') continue;

        if (!tax[d]) {
          tax[d] = {
            unitLabel: `Unit: ${d}`,
            code: d.substring(0, 3).toUpperCase(),
            chapters: [],
          };
        }

        const cName = (q.chapter || q.topic || '').trim();
        if (cName) {
          let chap = tax[d].chapters.find((c: any) => c.name.toLowerCase() === cName.toLowerCase());
          if (!chap) {
            chap = { name: cName, code: `${tax[d].code || 'CH'}.${tax[d].chapters.length + 1}`, lessons: [] };
            tax[d].chapters.push(chap);
          }

          const lName = (q.lesson || '').trim();
          if (lName && !chap.lessons.some((l: string) => l.toLowerCase() === lName.toLowerCase())) {
            chap.lessons.push(lName);
          }
        }
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO curriculum_taxonomy (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `).run('curriculum_taxonomy', JSON.stringify(tax), now);
    } catch (qErr) {
      console.warn('[Server Taxonomy] Notice bootstrapping taxonomy:', qErr);
    }

    res.json(tax);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taxonomy', (req: Request, res: Response) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid taxonomy payload' });
    }
    const now = new Date().toISOString();
    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO curriculum_taxonomy (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run('curriculum_taxonomy', JSON.stringify(data), now);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Taxonomy] Error saving taxonomy in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taxonomy/domain', (req: Request, res: Response) => {
  try {
    const { name, unitLabel, code, oldName } = req.body;
    const trimmed = (name || '').trim();
    if (!trimmed) return res.status(400).json({ error: 'Domain name is required' });

    const result = runInUnitOfWork(() => {
      const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
      let tax: Record<string, any> = {};
      if (row && row.data) {
        try { tax = JSON.parse(row.data) || {}; } catch {}
      }

      if (oldName && oldName.trim() && oldName.trim() !== trimmed && tax[oldName.trim()]) {
        const existing = tax[oldName.trim()];
        delete tax[oldName.trim()];
        tax[trimmed] = {
          ...existing,
          unitLabel: unitLabel || existing.unitLabel || `Unit: ${trimmed}`,
          code: code || existing.code || trimmed.substring(0, 3).toUpperCase(),
        };
        // Update questions table
        db.prepare('UPDATE questions SET domain = ? WHERE domain = ?').run(trimmed, oldName.trim());
      } else {
        const existing = tax[trimmed];
        tax[trimmed] = {
          unitLabel: unitLabel || existing?.unitLabel || `Unit: ${trimmed}`,
          code: code || existing?.code || trimmed.substring(0, 3).toUpperCase(),
          chapters: existing?.chapters || [],
        };
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO curriculum_taxonomy (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `).run('curriculum_taxonomy', JSON.stringify(tax), now);

      return tax;
    });

    res.json({ success: true, taxonomy: result });
  } catch (err: any) {
    console.error('Error saving domain in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taxonomy/chapter', (req: Request, res: Response) => {
  try {
    const { domain, name, code, oldName, targetDomain } = req.body;
    const dTrim = (domain || '').trim();
    const cTrim = (name || '').trim();
    if (!dTrim || !cTrim) return res.status(400).json({ error: 'Domain and chapter name required' });

    const result = runInUnitOfWork(() => {
      const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
      let tax: Record<string, any> = {};
      if (row && row.data) {
        try { tax = JSON.parse(row.data) || {}; } catch {}
      }

      if (!tax[dTrim]) {
        tax[dTrim] = { unitLabel: `Unit: ${dTrim}`, code: dTrim.substring(0, 3).toUpperCase(), chapters: [] };
      }

      const destDomain = (targetDomain || dTrim).trim();
      if (!tax[destDomain]) {
        tax[destDomain] = { unitLabel: `Unit: ${destDomain}`, code: destDomain.substring(0, 3).toUpperCase(), chapters: [] };
      }

      if (oldName && oldName.trim()) {
        const srcChapIndex = tax[dTrim].chapters.findIndex((c: any) => c.name.toLowerCase() === oldName.trim().toLowerCase());
        if (srcChapIndex >= 0) {
          const existingChap = tax[dTrim].chapters[srcChapIndex];
          tax[dTrim].chapters.splice(srcChapIndex, 1);
          const finalChap = {
            ...existingChap,
            name: cTrim,
            code: code || existingChap.code,
          };
          tax[destDomain].chapters.push(finalChap);
          // Update questions table
          db.prepare('UPDATE questions SET domain = ?, chapter = ? WHERE domain = ? AND chapter = ?').run(
            destDomain,
            cTrim,
            dTrim,
            oldName.trim()
          );
        } else {
          tax[destDomain].chapters.push({ name: cTrim, code: code || 'CH.1', lessons: [] });
        }
      } else {
        const existingChap = tax[dTrim].chapters.find((c: any) => c.name.toLowerCase() === cTrim.toLowerCase());
        if (!existingChap) {
          tax[dTrim].chapters.push({
            name: cTrim,
            code: code || `${tax[dTrim].code || 'CH'}.${tax[dTrim].chapters.length + 1}`,
            lessons: [],
          });
        }
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO curriculum_taxonomy (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `).run('curriculum_taxonomy', JSON.stringify(tax), now);

      return tax;
    });

    res.json({ success: true, taxonomy: result });
  } catch (err: any) {
    console.error('Error saving chapter in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/taxonomy/lesson', (req: Request, res: Response) => {
  try {
    const { domain, chapter, name, oldName, targetDomain, targetChapter } = req.body;
    const dTrim = (domain || '').trim();
    const cTrim = (chapter || '').trim();
    const lTrim = (name || '').trim();
    if (!dTrim || !cTrim || !lTrim) return res.status(400).json({ error: 'Domain, chapter, and lesson name required' });

    const result = runInUnitOfWork(() => {
      const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
      let tax: Record<string, any> = {};
      if (row && row.data) {
        try { tax = JSON.parse(row.data) || {}; } catch {}
      }

      if (!tax[dTrim]) {
        tax[dTrim] = { unitLabel: `Unit: ${dTrim}`, code: dTrim.substring(0, 3).toUpperCase(), chapters: [] };
      }

      let chap = tax[dTrim].chapters.find((c: any) => c.name.toLowerCase() === cTrim.toLowerCase());
      if (!chap) {
        chap = { name: cTrim, code: `${tax[dTrim].code || 'CH'}.1`, lessons: [] };
        tax[dTrim].chapters.push(chap);
      }

      const destDomain = (targetDomain || dTrim).trim();
      const destChapter = (targetChapter || cTrim).trim();

      if (oldName && oldName.trim()) {
        chap.lessons = chap.lessons.filter((l: string) => l.toLowerCase() !== oldName.trim().toLowerCase());
        if (!tax[destDomain]) {
          tax[destDomain] = { unitLabel: `Unit: ${destDomain}`, code: destDomain.substring(0, 3).toUpperCase(), chapters: [] };
        }
        let targetChap = tax[destDomain].chapters.find((c: any) => c.name.toLowerCase() === destChapter.toLowerCase());
        if (!targetChap) {
          targetChap = { name: destChapter, code: 'CH.1', lessons: [] };
          tax[destDomain].chapters.push(targetChap);
        }
        if (!targetChap.lessons.some((l: string) => l.toLowerCase() === lTrim.toLowerCase())) {
          targetChap.lessons.push(lTrim);
        }
        // Update questions
        db.prepare('UPDATE questions SET domain = ?, chapter = ?, lesson = ? WHERE domain = ? AND chapter = ? AND lesson = ?').run(
          destDomain,
          destChapter,
          lTrim,
          dTrim,
          cTrim,
          oldName.trim()
        );
      } else {
        if (!chap.lessons.some((l: string) => l.toLowerCase() === lTrim.toLowerCase())) {
          chap.lessons.push(lTrim);
        }
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO curriculum_taxonomy (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `).run('curriculum_taxonomy', JSON.stringify(tax), now);

      return tax;
    });

    res.json({ success: true, taxonomy: result });
  } catch (err: any) {
    console.error('Error saving lesson in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/taxonomy', (req: Request, res: Response) => {
  try {
    const { type, domain, chapter, lesson, deleteQuestions } = req.body;
    const shouldDeleteQuestions = Boolean(deleteQuestions);

    const result = runInUnitOfWork(() => {
      const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
      let tax: Record<string, any> = {};
      if (row && row.data) {
        try { tax = JSON.parse(row.data) || {}; } catch {}
      }

      const dTrim = (domain || '').trim();
      const cTrim = (chapter || '').trim();
      const lTrim = (lesson || '').trim();

      if (type === 'domain' && dTrim) {
        const matchKey = Object.keys(tax).find((k) => k.trim().toLowerCase() === dTrim.toLowerCase()) || dTrim;
        delete tax[matchKey];

        if (shouldDeleteQuestions) {
          const qIds = (db.prepare('SELECT id FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?)').all(dTrim) as Array<{ id: string }>).map((r) => r.id);
          internalDeleteQuestionsInUow(qIds);
        } else {
          const qRows = db.prepare('SELECT id, data FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?)').all(dTrim) as Array<{ id: string; data: string }>;
          const updateStmt = db.prepare('UPDATE questions SET domain = ?, chapter = ?, lesson = ?, data = ?, updated_at = ? WHERE id = ?');
          const now = new Date().toISOString();
          for (const qRow of qRows) {
            try {
              const qData = JSON.parse(qRow.data);
              qData.domain = 'Unassigned';
              qData.chapter = '';
              qData.lesson = '';
              qData.updatedAt = now;
              updateStmt.run('Unassigned', '', '', JSON.stringify(qData), now, qRow.id);
            } catch {}
          }
        }
      } else if (type === 'chapter' && dTrim && cTrim) {
        const matchDKey = Object.keys(tax).find((k) => k.trim().toLowerCase() === dTrim.toLowerCase()) || dTrim;
        if (tax[matchDKey] && Array.isArray(tax[matchDKey].chapters)) {
          tax[matchDKey].chapters = tax[matchDKey].chapters.filter(
            (c: any) => (c.name || '').trim().toLowerCase() !== cTrim.toLowerCase()
          );
        }

        if (shouldDeleteQuestions) {
          const qIds = (db.prepare('SELECT id FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?)').all(dTrim, cTrim) as Array<{ id: string }>).map((r) => r.id);
          internalDeleteQuestionsInUow(qIds);
        } else {
          const qRows = db.prepare('SELECT id, data FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?)').all(dTrim, cTrim) as Array<{ id: string; data: string }>;
          const updateStmt = db.prepare('UPDATE questions SET chapter = ?, lesson = ?, data = ?, updated_at = ? WHERE id = ?');
          const now = new Date().toISOString();
          for (const qRow of qRows) {
            try {
              const qData = JSON.parse(qRow.data);
              qData.chapter = '';
              qData.lesson = '';
              qData.updatedAt = now;
              updateStmt.run('', '', JSON.stringify(qData), now, qRow.id);
            } catch {}
          }
        }
      } else if (type === 'lesson' && dTrim && cTrim && lTrim) {
        const matchDKey = Object.keys(tax).find((k) => k.trim().toLowerCase() === dTrim.toLowerCase()) || dTrim;
        if (tax[matchDKey] && Array.isArray(tax[matchDKey].chapters)) {
          const chap = tax[matchDKey].chapters.find(
            (c: any) => (c.name || '').trim().toLowerCase() === cTrim.toLowerCase()
          );
          if (chap && Array.isArray(chap.lessons)) {
            chap.lessons = chap.lessons.filter(
              (l: string) => l.trim().toLowerCase() !== lTrim.toLowerCase()
            );
          }
        }

        if (shouldDeleteQuestions) {
          const qIds = (db.prepare('SELECT id FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?) AND LOWER(TRIM(lesson)) = LOWER(?)').all(dTrim, cTrim, lTrim) as Array<{ id: string }>).map((r) => r.id);
          internalDeleteQuestionsInUow(qIds);
        } else {
          const qRows = db.prepare('SELECT id, data FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?) AND LOWER(TRIM(lesson)) = LOWER(?)').all(dTrim, cTrim, lTrim) as Array<{ id: string; data: string }>;
          const updateStmt = db.prepare('UPDATE questions SET lesson = ?, data = ?, updated_at = ? WHERE id = ?');
          const now = new Date().toISOString();
          for (const qRow of qRows) {
            try {
              const qData = JSON.parse(qRow.data);
              qData.lesson = '';
              qData.updatedAt = now;
              updateStmt.run('', JSON.stringify(qData), now, qRow.id);
            } catch {}
          }
        }
      } else if (type === 'all') {
        tax = {};
        if (shouldDeleteQuestions) {
          db.prepare('DELETE FROM questions').run();
        } else {
          const qRows = db.prepare('SELECT id, data FROM questions').all() as Array<{ id: string; data: string }>;
          const updateStmt = db.prepare('UPDATE questions SET domain = ?, chapter = ?, lesson = ?, data = ?, updated_at = ? WHERE id = ?');
          const now = new Date().toISOString();
          for (const qRow of qRows) {
            try {
              const qData = JSON.parse(qRow.data);
              qData.domain = 'Unassigned';
              qData.chapter = '';
              qData.lesson = '';
              qData.updatedAt = now;
              updateStmt.run('Unassigned', '', '', JSON.stringify(qData), now, qRow.id);
            } catch {}
          }
        }
      }

      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO curriculum_taxonomy (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
      `).run('curriculum_taxonomy', JSON.stringify(tax), now);

      return tax;
    });

    res.json({ success: true, taxonomy: result });
  } catch (err: any) {
    console.error('Error deleting taxonomy in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Generic Unit of Work (Atomic Multi-Entity Transaction Coordinator)
// -----------------------------------------------------------------------------
app.post('/api/unit-of-work', (req: Request, res: Response) => {
  try {
    const { operations } = req.body;
    if (!Array.isArray(operations) || operations.length === 0) {
      return res.status(400).json({ error: 'Operations array is required' });
    }

    const now = new Date().toISOString();
    const results = runInUnitOfWork(() => {
      const opResults: any[] = [];

      for (const op of operations) {
        if (!op || !op.type) continue;

        switch (op.type) {
          case 'save_question': {
            const res = internalSaveQuestionsInUow([op.payload], now);
            opResults.push({ type: op.type, success: true, count: res.count });
            break;
          }

          case 'delete_question': {
            const qId = op.payload?.id;
            if (qId) {
              internalDeleteQuestionsInUow([qId]);
              opResults.push({ type: op.type, success: true, id: qId });
            }
            break;
          }

          case 'save_domain': {
            const { name, unitLabel, code } = op.payload || {};
            const trimmed = (name || '').trim();
            if (!trimmed) throw new Error('Domain name is required in Unit of Work');

            const taxRow = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
            let tax: Record<string, any> = {};
            if (taxRow && taxRow.data) {
              try { tax = JSON.parse(taxRow.data) || {}; } catch {}
            }

            const existing = tax[trimmed];
            tax[trimmed] = {
              unitLabel: unitLabel || existing?.unitLabel || `Unit: ${trimmed}`,
              code: code || existing?.code || trimmed.substring(0, 3).toUpperCase(),
              chapters: existing?.chapters || [],
            };

            db.prepare(`
              INSERT INTO curriculum_taxonomy (id, data, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            `).run('curriculum_taxonomy', JSON.stringify(tax), now);

            opResults.push({ type: op.type, success: true, domain: trimmed });
            break;
          }

          case 'save_chapter': {
            const { domain, name, code } = op.payload || {};
            const dTrim = (domain || '').trim();
            const cTrim = (name || '').trim();
            if (!dTrim || !cTrim) throw new Error('Domain and chapter name required in Unit of Work');

            const taxRow = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
            let tax: Record<string, any> = {};
            if (taxRow && taxRow.data) {
              try { tax = JSON.parse(taxRow.data) || {}; } catch {}
            }

            if (!tax[dTrim]) {
              tax[dTrim] = { unitLabel: `Unit: ${dTrim}`, code: dTrim.substring(0, 3).toUpperCase(), chapters: [] };
            }

            const existingChap = tax[dTrim].chapters.find((c: any) => (c.name || '').toLowerCase() === cTrim.toLowerCase());
            if (!existingChap) {
              tax[dTrim].chapters.push({
                name: cTrim,
                code: code || `${tax[dTrim].code || 'CH'}.${tax[dTrim].chapters.length + 1}`,
                lessons: [],
              });
            }

            db.prepare(`
              INSERT INTO curriculum_taxonomy (id, data, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            `).run('curriculum_taxonomy', JSON.stringify(tax), now);

            opResults.push({ type: op.type, success: true, domain: dTrim, chapter: cTrim });
            break;
          }

          case 'save_lesson': {
            const { domain, chapter, name } = op.payload || {};
            const dTrim = (domain || '').trim();
            const cTrim = (chapter || '').trim();
            const lTrim = (name || '').trim();
            if (!dTrim || !cTrim || !lTrim) throw new Error('Domain, chapter, and lesson name required in Unit of Work');

            const taxRow = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
            let tax: Record<string, any> = {};
            if (taxRow && taxRow.data) {
              try { tax = JSON.parse(taxRow.data) || {}; } catch {}
            }

            if (!tax[dTrim]) {
              tax[dTrim] = { unitLabel: `Unit: ${dTrim}`, code: dTrim.substring(0, 3).toUpperCase(), chapters: [] };
            }

            let chap = tax[dTrim].chapters.find((c: any) => (c.name || '').toLowerCase() === cTrim.toLowerCase());
            if (!chap) {
              chap = { name: cTrim, code: `${tax[dTrim].code || 'CH'}.${tax[dTrim].chapters.length + 1}`, lessons: [] };
              tax[dTrim].chapters.push(chap);
            }

            if (!chap.lessons.some((l: string) => l.toLowerCase() === lTrim.toLowerCase())) {
              chap.lessons.push(lTrim);
            }

            db.prepare(`
              INSERT INTO curriculum_taxonomy (id, data, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            `).run('curriculum_taxonomy', JSON.stringify(tax), now);

            opResults.push({ type: op.type, success: true, domain: dTrim, chapter: cTrim, lesson: lTrim });
            break;
          }

          case 'save_assessment': {
            const assessment = op.payload;
            if (!assessment?.id) throw new Error('Assessment ID required in Unit of Work');
            const stmt = db.prepare(`
              INSERT INTO assessments (id, title, subject, grade, data, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                subject = excluded.subject,
                grade = excluded.grade,
                data = excluded.data,
                updated_at = excluded.updated_at
            `);
            stmt.run(
              assessment.id,
              assessment.title || '',
              assessment.subject || '',
              assessment.grade || '',
              JSON.stringify(assessment),
              assessment.createdAt || now,
              now
            );
            opResults.push({ type: op.type, success: true, id: assessment.id });
            break;
          }

          case 'delete_assessment': {
            const aId = op.payload?.id;
            if (aId) {
              internalDeleteAssessmentInUow(aId);
              opResults.push({ type: op.type, success: true, id: aId });
            }
            break;
          }

          case 'save_collection': {
            const col = op.payload;
            if (!col?.name) throw new Error('Collection name required in Unit of Work');
            const colId = col.id || col.name;
            db.prepare(`
              INSERT INTO collections (id, name, data, updated_at)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                data = excluded.data,
                updated_at = excluded.updated_at
            `).run(colId, col.name, JSON.stringify(col), now);
            opResults.push({ type: op.type, success: true, id: colId });
            break;
          }

          case 'save_attempt': {
            const attempt = op.payload;
            if (!attempt?.id) throw new Error('Attempt ID required in Unit of Work');
            const assessmentId = attempt.assessment_id || attempt.assessmentId || '';
            const studentName = attempt.student_name || attempt.studentName || '';
            const studentEmail = attempt.student_email || attempt.studentEmail || '';
            const status = attempt.status || 'in_progress';
            const reportDataStr = attempt.report_data ? JSON.stringify(attempt.report_data) : (attempt.fullReport ? JSON.stringify(attempt.fullReport) : null);

            db.prepare(`
              INSERT INTO attempts (id, assessment_id, student_name, student_email, status, data, report_data, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                assessment_id = excluded.assessment_id,
                student_name = excluded.student_name,
                student_email = excluded.student_email,
                status = excluded.status,
                data = excluded.data,
                report_data = COALESCE(excluded.report_data, attempts.report_data),
                updated_at = excluded.updated_at
            `).run(
              attempt.id,
              assessmentId,
              studentName,
              studentEmail,
              status,
              JSON.stringify(attempt),
              reportDataStr,
              attempt.started_at || attempt.startedAt || now,
              now
            );

            if (attempt.survey_responses || attempt.surveyResponses) {
              const sResp = attempt.survey_responses || attempt.surveyResponses;
              const respId = `sr-${attempt.id}`;
              db.prepare(`
                INSERT INTO survey_responses (id, attempt_id, student_email, data, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET data = excluded.data
              `).run(respId, attempt.id, studentEmail, JSON.stringify(sResp), now);
            }

            opResults.push({ type: op.type, success: true, id: attempt.id });
            break;
          }

          case 'save_questions': {
            const items = Array.isArray(op.payload) ? op.payload : [op.payload];
            const res = internalSaveQuestionsInUow(items, now);
            opResults.push({ type: op.type, success: true, count: res.count, ids: res.savedIds });
            break;
          }

          case 'delete_collection': {
            const colId = op.payload?.id || op.payload?.name;
            if (colId) {
              db.prepare('DELETE FROM collections WHERE id = ? OR name = ?').run(colId, colId);
              opResults.push({ type: op.type, success: true, id: colId });
            }
            break;
          }

          case 'delete_attempt': {
            const attId = op.payload?.id;
            if (attId) {
              internalDeleteAttemptInUow(attId);
              opResults.push({ type: op.type, success: true, id: attId });
            }
            break;
          }

          case 'delete_taxonomy': {
            const { type, domain, chapter, lesson, deleteQuestions } = op.payload || {};
            const shouldDeleteQuestions = Boolean(deleteQuestions);
            const row = db.prepare('SELECT data FROM curriculum_taxonomy WHERE id = ?').get('curriculum_taxonomy') as { data: string } | undefined;
            let tax: Record<string, any> = {};
            if (row && row.data) {
              try { tax = JSON.parse(row.data) || {}; } catch {}
            }

            const dTrim = (domain || '').trim();
            const cTrim = (chapter || '').trim();
            const lTrim = (lesson || '').trim();

            if (type === 'domain' && dTrim) {
              const matchKey = Object.keys(tax).find((k) => k.trim().toLowerCase() === dTrim.toLowerCase()) || dTrim;
              delete tax[matchKey];
              if (shouldDeleteQuestions) {
                const qIds = (db.prepare('SELECT id FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?)').all(dTrim) as Array<{ id: string }>).map((r) => r.id);
                internalDeleteQuestionsInUow(qIds);
              } else {
                db.prepare('UPDATE questions SET domain = ?, chapter = ?, lesson = ? WHERE LOWER(TRIM(domain)) = LOWER(?)').run('Unassigned', '', '', dTrim);
              }
            } else if (type === 'chapter' && dTrim && cTrim) {
              const matchDKey = Object.keys(tax).find((k) => k.trim().toLowerCase() === dTrim.toLowerCase()) || dTrim;
              if (tax[matchDKey] && Array.isArray(tax[matchDKey].chapters)) {
                tax[matchDKey].chapters = tax[matchDKey].chapters.filter((c: any) => (c.name || '').trim().toLowerCase() !== cTrim.toLowerCase());
              }
              if (shouldDeleteQuestions) {
                const qIds = (db.prepare('SELECT id FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?)').all(dTrim, cTrim) as Array<{ id: string }>).map((r) => r.id);
                internalDeleteQuestionsInUow(qIds);
              } else {
                db.prepare('UPDATE questions SET chapter = ?, lesson = ? WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?)').run('', '', dTrim, cTrim);
              }
            } else if (type === 'lesson' && dTrim && cTrim && lTrim) {
              const matchDKey = Object.keys(tax).find((k) => k.trim().toLowerCase() === dTrim.toLowerCase()) || dTrim;
              if (tax[matchDKey] && Array.isArray(tax[matchDKey].chapters)) {
                const chap = tax[matchDKey].chapters.find((c: any) => (c.name || '').trim().toLowerCase() === cTrim.toLowerCase());
                if (chap && Array.isArray(chap.lessons)) {
                  chap.lessons = chap.lessons.filter((l: string) => l.trim().toLowerCase() !== lTrim.toLowerCase());
                }
              }
              if (shouldDeleteQuestions) {
                const qIds = (db.prepare('SELECT id FROM questions WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?) AND LOWER(TRIM(lesson)) = LOWER(?)').all(dTrim, cTrim, lTrim) as Array<{ id: string }>).map((r) => r.id);
                internalDeleteQuestionsInUow(qIds);
              } else {
                db.prepare('UPDATE questions SET lesson = ? WHERE LOWER(TRIM(domain)) = LOWER(?) AND LOWER(TRIM(chapter)) = LOWER(?) AND LOWER(TRIM(lesson)) = LOWER(?)').run('', dTrim, cTrim, lTrim);
              }
            } else if (type === 'all') {
              tax = {};
              if (shouldDeleteQuestions) {
                db.prepare('DELETE FROM questions').run();
              } else {
                db.prepare('UPDATE questions SET domain = ?, chapter = ?, lesson = ?').run('Unassigned', '', '');
              }
            }

            db.prepare(`
              INSERT INTO curriculum_taxonomy (id, data, updated_at)
              VALUES (?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
            `).run('curriculum_taxonomy', JSON.stringify(tax), now);

            opResults.push({ type: op.type, success: true });
            break;
          }

          default:
            console.warn(`[UnitOfWork] Unknown operation type: ${(op as any).type}`);
        }
      }

      return opResults;
    });

    res.json({ success: true, count: operations.length, results });
  } catch (err: any) {
    console.error('[UnitOfWork] Transaction execution error:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Assessment Attempts & Reports
// -----------------------------------------------------------------------------
app.get('/api/attempts', (req: Request, res: Response) => {
  try {
    const assessmentId = req.query.assessmentId as string | undefined;
    let rows: Array<{ data: string; report_data: string | null }>;

    if (assessmentId) {
      rows = db.prepare('SELECT data, report_data FROM attempts WHERE assessment_id = ? ORDER BY created_at DESC').all(assessmentId) as any;
    } else {
      rows = db.prepare('SELECT data, report_data FROM attempts ORDER BY created_at DESC').all() as any;
    }

    const list = rows.map((r) => {
      const parsed = JSON.parse(r.data);
      if (r.report_data && !parsed.report_data) {
        parsed.report_data = JSON.parse(r.report_data);
      }
      return parsed;
    });

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/attempts/:id', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data, report_data FROM attempts WHERE id = ?').get(req.params.id) as { data: string; report_data: string | null } | undefined;
    if (!row) {
      return res.status(404).json({ error: 'Attempt not found in database' });
    }
    const parsed = JSON.parse(row.data);
    if (row.report_data) {
      parsed.report_data = JSON.parse(row.report_data);
    }
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/attempts', (req: Request, res: Response) => {
  try {
    const attempt = req.body;
    if (!attempt || !attempt.id) {
      return res.status(400).json({ error: 'Attempt id is required' });
    }

    const now = new Date().toISOString();
    const assessmentId = attempt.assessment_id || attempt.assessmentId || '';
    const studentName = attempt.student_name || attempt.studentName || '';
    const studentEmail = attempt.student_email || attempt.studentEmail || '';
    const status = attempt.status || 'in_progress';
    const reportDataStr = attempt.report_data ? JSON.stringify(attempt.report_data) : (attempt.fullReport ? JSON.stringify(attempt.fullReport) : null);

    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO attempts (id, assessment_id, student_name, student_email, status, data, report_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          assessment_id = excluded.assessment_id,
          student_name = excluded.student_name,
          student_email = excluded.student_email,
          status = excluded.status,
          data = excluded.data,
          report_data = COALESCE(excluded.report_data, attempts.report_data),
          updated_at = excluded.updated_at
      `);

      stmt.run(
        attempt.id,
        assessmentId,
        studentName,
        studentEmail,
        status,
        JSON.stringify(attempt),
        reportDataStr,
        attempt.started_at || attempt.startedAt || now,
        now
      );

      if (attempt.survey_responses || attempt.surveyResponses) {
        const sResp = attempt.survey_responses || attempt.surveyResponses;
        const respId = `sr-${attempt.id}`;
        db.prepare(`
          INSERT INTO survey_responses (id, attempt_id, student_email, data, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data
        `).run(respId, attempt.id, studentEmail, JSON.stringify(sResp), now);
      }
    });

    res.json({ success: true, attempt });
  } catch (err: any) {
    console.error('Error saving attempt in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/attempts/:id', (req: Request, res: Response) => {
  try {
    runInUnitOfWork(() => {
      internalDeleteAttemptInUow(req.params.id);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting attempt in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Report Templates
// -----------------------------------------------------------------------------
app.get('/api/report-templates/:id?', (req: Request, res: Response) => {
  try {
    const id = req.params.id || 'global';
    const row = db.prepare('SELECT data FROM report_templates WHERE id = ?').get(id) as { data: string } | undefined;
    if (!row) {
      // If assessment specific template not found, return global template if available
      if (id !== 'global') {
        const globalRow = db.prepare('SELECT data FROM report_templates WHERE id = ?').get('global') as { data: string } | undefined;
        return res.json(globalRow ? JSON.parse(globalRow.data) : null);
      }
      return res.json(null);
    }
    res.json(JSON.parse(row.data));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/report-templates', (req: Request, res: Response) => {
  try {
    const { id, template } = req.body;
    const templateId = id || 'global';
    const now = new Date().toISOString();

    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO report_templates (id, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `);

      stmt.run(templateId, JSON.stringify(template), now);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error saving report template in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/report-templates/:id', (req: Request, res: Response) => {
  try {
    runInUnitOfWork(() => {
      db.prepare('DELETE FROM report_templates WHERE id = ?').run(req.params.id);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting report template in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: Surveys
// -----------------------------------------------------------------------------
app.get('/api/surveys/questions', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM survey_questions ORDER BY updated_at ASC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/surveys/questions', (req: Request, res: Response) => {
  try {
    const questions = req.body;
    const items = Array.isArray(questions) ? questions : [questions];
    const now = new Date().toISOString();

    runInUnitOfWork(() => {
      db.prepare('DELETE FROM survey_questions').run();
      const stmt = db.prepare('INSERT INTO survey_questions (id, data, updated_at) VALUES (?, ?, ?)');
      for (const q of items) {
        if (!q || !q.id) continue;
        stmt.run(q.id, JSON.stringify(q), now);
      }
    });
    res.json({ success: true, count: items.length });
  } catch (err: any) {
    console.error('Error saving survey questions in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/surveys/action-plans', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM action_plans ORDER BY updated_at ASC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/surveys/action-plans', (req: Request, res: Response) => {
  try {
    const plans = req.body;
    const items = Array.isArray(plans) ? plans : [plans];
    const now = new Date().toISOString();

    runInUnitOfWork(() => {
      db.prepare('DELETE FROM action_plans').run();
      const stmt = db.prepare('INSERT INTO action_plans (id, data, updated_at) VALUES (?, ?, ?)');
      for (const p of items) {
        if (!p || !p.id) continue;
        stmt.run(p.id, JSON.stringify(p), now);
      }
    });
    res.json({ success: true, count: items.length });
  } catch (err: any) {
    console.error('Error saving action plans in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/surveys/responses', (_req: Request, res: Response) => {
  try {
    const rows = db.prepare('SELECT data FROM survey_responses ORDER BY created_at DESC').all() as Array<{ data: string }>;
    res.json(rows.map((r) => JSON.parse(r.data)));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/surveys/responses', (req: Request, res: Response) => {
  try {
    const resp = req.body;
    const id = resp.id || `sr-${Date.now()}`;
    const now = new Date().toISOString();

    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO survey_responses (id, attempt_id, student_email, data, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data
      `);
      stmt.run(id, resp.attemptId || '', resp.studentEmail || '', JSON.stringify(resp), now);
    });
    res.json({ success: true, id });
  } catch (err: any) {
    console.error('Error saving survey responses in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// REST API: App Settings (Organization, Registration Fields, Levels/Courses)
// -----------------------------------------------------------------------------
app.get('/api/settings/:key', (req: Request, res: Response) => {
  try {
    const row = db.prepare('SELECT data FROM app_settings WHERE key = ?').get(req.params.key) as { data: string } | undefined;
    res.json(row ? JSON.parse(row.data) : null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings/:key', (req: Request, res: Response) => {
  try {
    const data = req.body;
    const now = new Date().toISOString();
    runInUnitOfWork(() => {
      const stmt = db.prepare(`
        INSERT INTO app_settings (key, data, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          data = excluded.data,
          updated_at = excluded.updated_at
      `);
      stmt.run(req.params.key, JSON.stringify(data), now);
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error saving settings in Unit of Work:', err);
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// Dev & Production Middleware Setup
// -----------------------------------------------------------------------------
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Diagnostic Testing Platform running with SQLite database at http://0.0.0.0:${port}`);
  });
}

startServer();
