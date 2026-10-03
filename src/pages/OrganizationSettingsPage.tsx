import { useEffect, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import DynamicRegistrationField from '../components/DynamicRegistrationField'
import { useUnsavedChanges } from '../contexts/UnsavedChangesContext'
import { supabase } from '../lib/supabaseClient'
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  Plus,
  Check,
  AlertCircle,
  X,
  Smartphone,
} from 'lucide-react'

export type FieldType =
  | 'text'
  | 'email'
  | 'phone'
  | 'number'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'date'
  | 'textarea'

export interface RegistrationField {
  id: string
  organization_id?: string
  label: string
  field_key: string
  field_type: FieldType
  is_required: boolean
  options: string[] | null
  display_order: number
  is_active: boolean
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short Text',
  email: 'Email Address',
  phone: 'Phone Number',
  number: 'Number',
  dropdown: 'Dropdown Select',
  radio: 'Single Choice (Radio)',
  checkbox: 'Multiple Choice (Checkboxes)',
  date: 'Date Picker',
  textarea: 'Long Paragraph / Notes',
}

const STORAGE_FIELDS_KEY = 'math_diag_registration_fields'

const DEFAULT_REGISTRATION_FIELDS: RegistrationField[] = [
  {
    id: 'fld-1',
    label: 'Student Full Name',
    field_key: 'full_name',
    field_type: 'text',
    is_required: true,
    options: null,
    display_order: 0,
    is_active: true,
  },
  {
    id: 'fld-2',
    label: 'Student Email Address',
    field_key: 'email',
    field_type: 'email',
    is_required: true,
    options: null,
    display_order: 1,
    is_active: true,
  },
  {
    id: 'fld-3',
    label: 'WhatsApp Contact Number',
    field_key: 'whatsapp_number',
    field_type: 'phone',
    is_required: false,
    options: null,
    display_order: 2,
    is_active: true,
  },
  {
    id: 'fld-4',
    label: 'Current Grade / Level',
    field_key: 'grade_level',
    field_type: 'dropdown',
    is_required: true,
    options: ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12', 'Graduated / Gap Year'],
    display_order: 3,
    is_active: true,
  },
  {
    id: 'fld-5',
    label: 'Target Exam Track',
    field_key: 'target_exam',
    field_type: 'radio',
    is_required: false,
    options: ['EST 1 Math', 'Digital SAT Math', 'ACT Math', 'Pre-Calculus / AP Calculus'],
    display_order: 4,
    is_active: true,
  },
]

export default function OrganizationSettingsPage() {
  const [fields, setFields] = useState<RegistrationField[]>([])
  const [orgId, setOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Branding & Marketing state
  const [tagline, setTagline] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Add / Edit Field Modal State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldLabel, setFieldLabel] = useState('')
  const [fieldKey, setFieldKey] = useState('')
  const [fieldType, setFieldType] = useState<FieldType>('text')
  const [isRequired, setIsRequired] = useState(true)
  const [optionsText, setOptionsText] = useState('')
  const [savingField, setSavingField] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)

  // In-app Delete Confirmation Modal State (replaces blocked window.confirm)
  const [fieldToDelete, setFieldToDelete] = useState<RegistrationField | null>(null)

  // Interactive Live Preview State
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchData()
  }, [])

  function saveFieldsToStorage(updatedFields: RegistrationField[]) {
    try {
      localStorage.setItem(STORAGE_FIELDS_KEY, JSON.stringify(updatedFields))
    } catch (e) {
      console.error('Failed to write registration fields to localStorage:', e)
    }
  }

  async function fetchData() {
    setLoading(true)

    // 1. Load from localStorage first
    let initialFields: RegistrationField[] = []
    const rawLocal = localStorage.getItem(STORAGE_FIELDS_KEY)
    if (rawLocal) {
      try {
        const parsed = JSON.parse(rawLocal)
        if (Array.isArray(parsed) && parsed.length > 0) {
          initialFields = parsed
        }
      } catch {}
    }

    if (initialFields.length === 0) {
      initialFields = DEFAULT_REGISTRATION_FIELDS
      saveFieldsToStorage(DEFAULT_REGISTRATION_FIELDS)
    }
    setFields(initialFields)

    // 2. Query Supabase in parallel if configured
    try {
      const { data: orgData } = await supabase.from('organizations').select('id').limit(1).single()
      if (orgData) setOrgId(orgData.id)

      const [{ data: fieldData }, { data: orgSettings }] = await Promise.all([
        supabase.from('registration_fields').select('*').order('display_order'),
        supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
      ])

      if (Array.isArray(fieldData) && fieldData.length > 0) {
        setFields(fieldData as RegistrationField[])
        saveFieldsToStorage(fieldData as RegistrationField[])
      }

      if (orgSettings) {
        setTagline(orgSettings.marketing_tagline ?? '')
        setPhone(orgSettings.contact_phone ?? '')
        setWhatsapp(orgSettings.whatsapp_url ?? '')
        setWebsiteUrl(orgSettings.website_url ?? '')
      }
    } catch {}

    setLoading(false)
  }

  function slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  function handleLabelChange(value: string) {
    setFieldLabel(value)
    if (modalMode === 'create') {
      setFieldKey(slugify(value))
    }
  }

  function openCreateModal() {
    setModalMode('create')
    setEditingFieldId(null)
    setFieldLabel('')
    setFieldKey('')
    setFieldType('text')
    setIsRequired(true)
    setOptionsText('')
    setFieldError(null)
  }

  function openEditModal(field: RegistrationField) {
    setModalMode('edit')
    setEditingFieldId(field.id)
    setFieldLabel(field.label)
    setFieldKey(field.field_key)
    setFieldType(field.field_type)
    setIsRequired(field.is_required)
    setOptionsText(field.options?.join('\n') ?? '')
    setFieldError(null)
  }

  async function handleSaveField(e: React.FormEvent): Promise<boolean> {
    e.preventDefault()
    setFieldError(null)

    if (!fieldLabel.trim()) {
      setFieldError('Field label is required.')
      return false
    }

    const cleanKey = slugify(fieldKey || fieldLabel)
    if (!cleanKey) {
      setFieldError('Field key must contain letters or numbers.')
      return false
    }

    let parsedOptions: string[] | null = null
    if (['dropdown', 'radio', 'checkbox'].includes(fieldType)) {
      parsedOptions = optionsText
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
      if (parsedOptions.length === 0) {
        setFieldError('Please provide at least one option for dropdown/radio/checkbox fields.')
        return false
      }
    }

    setSavingField(true)

    let updatedFields: RegistrationField[] = []

    if (modalMode === 'create') {
      if (fields.some((f) => f.field_key === cleanKey)) {
        setFieldError(`A field with key "${cleanKey}" already exists. Choose a different label or key.`)
        setSavingField(false)
        return false
      }

      const newField: RegistrationField = {
        id: `fld-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        label: fieldLabel.trim(),
        field_key: cleanKey,
        field_type: fieldType,
        is_required: isRequired,
        options: parsedOptions,
        display_order: fields.length,
        is_active: true,
      }

      updatedFields = [...fields, newField]
      setFields(updatedFields)
      saveFieldsToStorage(updatedFields)

      // Sync with Supabase in background if possible
      if (orgId) {
        try {
          await supabase.from('registration_fields').insert({
            organization_id: orgId,
            label: newField.label,
            field_key: newField.field_key,
            field_type: newField.field_type,
            is_required: newField.is_required,
            options: newField.options,
            display_order: newField.display_order,
            is_active: true,
          })
        } catch {}
      }
    } else if (modalMode === 'edit' && editingFieldId) {
      updatedFields = fields.map((f) => {
        if (f.id === editingFieldId) {
          return {
            ...f,
            label: fieldLabel.trim(),
            field_type: fieldType,
            is_required: isRequired,
            options: parsedOptions,
          }
        }
        return f
      })
      setFields(updatedFields)
      saveFieldsToStorage(updatedFields)

      try {
        await supabase
          .from('registration_fields')
          .update({
            label: fieldLabel.trim(),
            field_type: fieldType,
            is_required: isRequired,
            options: parsedOptions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingFieldId)
      } catch {}
    }

    setSavingField(false)
    setModalMode(null)
    setHasUnsavedChanges(false)
    markClean()
    return true
  }

  function closeFieldEditor() {
    setModalMode(null)
    setHasUnsavedChanges(false)
    setFieldError(null)
  }

  // Swap places with Up or Down arrows
  async function moveField(index: number, direction: -1 | 1) {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return

    const updated = [...fields]
    const [movedItem] = updated.splice(index, 1)
    updated.splice(newIndex, 0, movedItem)

    const reordered = updated.map((f, idx) => ({
      ...f,
      display_order: idx,
    }))

    setFields(reordered)
    saveFieldsToStorage(reordered)

    // Sync to Supabase if available
    try {
      const a = reordered[index]
      const b = reordered[newIndex]
      await Promise.all([
        supabase.from('registration_fields').update({ display_order: a.display_order }).eq('id', a.id),
        supabase.from('registration_fields').update({ display_order: b.display_order }).eq('id', b.id),
      ])
    } catch {}
  }

  // Toggle Hide / Show (Active / Inactive)
  async function toggleFieldActive(field: RegistrationField) {
    const nextState = !field.is_active
    const updated = fields.map((f) => (f.id === field.id ? { ...f, is_active: nextState } : f))

    setFields(updated)
    saveFieldsToStorage(updated)

    // Sync to Supabase in background
    try {
      await supabase.from('registration_fields').update({ is_active: nextState }).eq('id', field.id)
    } catch {}
  }

  // Confirm delete of field
  async function handleConfirmDelete() {
    if (!fieldToDelete) return
    const targetId = fieldToDelete.id

    const updated = fields
      .filter((f) => f.id !== targetId)
      .map((f, idx) => ({ ...f, display_order: idx }))

    setFields(updated)
    saveFieldsToStorage(updated)
    setFieldToDelete(null)

    // Sync to Supabase
    try {
      await supabase.from('registration_fields').delete().eq('id', targetId)
    } catch {}
  }

  async function handleSaveBranding(e: React.FormEvent) {
    e.preventDefault()
    setSavingSettings(true)

    try {
      if (orgId) {
        await supabase.from('organization_settings').upsert({
          organization_id: orgId,
          marketing_tagline: tagline.trim() || null,
          contact_phone: phone.trim() || null,
          whatsapp_url: whatsapp.trim() || null,
          website_url: websiteUrl.trim() || null,
          updated_at: new Date().toISOString(),
        })
      }
    } catch {}

    setSavingSettings(false)
    setHasUnsavedChanges(false)
    markClean()
    setSettingsSavedMessage(true)
    setTimeout(() => setSettingsSavedMessage(false), 2500)
  }

  const savePendingChanges = async () => {
    const preventDefault = () => {}
    if (modalMode) {
      if (!(await handleSaveField({ preventDefault } as React.FormEvent))) {
        throw new Error('Please fix the registration field before saving.')
      }
    } else {
      await handleSaveBranding({ preventDefault } as React.FormEvent)
    }
  }
  const markClean = useUnsavedChanges(hasUnsavedChanges, savePendingChanges)

  return (
    <AdminLayout
      title="Registration Form & Organization Settings"
      subtitle="Customize what students must fill out before taking assessments and your report card branding"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl">
        {/* LEFT COLUMN: Registration Form Builder & Settings (7 cols) */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          {/* Form Builder Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">Student Registration Fields</h2>
                <p className="text-xs text-slate-500">
                  Manage required student intake fields before testing begins.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateModal}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 shrink-0 shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Custom Field</span>
              </button>
            </div>

            {loading ? (
              <p className="text-xs text-slate-400 py-4 text-center">Loading fields...</p>
            ) : fields.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-sm font-medium text-slate-600">No registration fields set up.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Add fields like "Full Name", "Parent WhatsApp", "Grade", etc.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {fields.map((f, index) => (
                  <div
                    key={f.id}
                    className={`border rounded-xl p-3.5 flex items-center justify-between gap-3 transition ${
                      f.is_active
                        ? 'bg-slate-50/70 border-slate-200 shadow-2xs'
                        : 'bg-slate-100/60 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 truncate">{f.label}</span>
                        <span className="text-[11px] font-mono text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          {f.field_key}
                        </span>
                        <span className="text-xs bg-blue-50 text-blue-700 font-medium px-2 py-0.5 rounded-md">
                          {FIELD_TYPE_LABELS[f.field_type] || f.field_type}
                        </span>
                        {f.is_required ? (
                          <span className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
                            Required *
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500 bg-slate-200 px-1.5 py-0.5 rounded">
                            Optional
                          </span>
                        )}
                        {!f.is_active && (
                          <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <EyeOff className="h-2.5 w-2.5" />
                            <span>Hidden</span>
                          </span>
                        )}
                      </div>

                      {f.options && f.options.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {f.options.map((opt, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded"
                            >
                              {opt}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Reorder, Edit, Toggle Hide, and Delete Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                        title="Move Up"
                        className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-30 transition cursor-pointer"
                      >
                        <ArrowUp className="h-3.5 w-3.5 text-slate-700" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveField(index, 1)}
                        disabled={index === fields.length - 1}
                        title="Move Down"
                        className="p-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 disabled:opacity-30 transition cursor-pointer"
                      >
                        <ArrowDown className="h-3.5 w-3.5 text-slate-700" />
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(f)}
                        className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-2.5 py-1 rounded-lg transition"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFieldActive(f)}
                        title={f.is_active ? 'Hide field from student registration' : 'Show field in student registration'}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                          f.is_active
                            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        {f.is_active ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        <span>{f.is_active ? 'Hide' : 'Show'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setFieldToDelete(f)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete field"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Branding & Marketing Details Form */}
          <form
            onSubmit={handleSaveBranding}
            onChangeCapture={() => setHasUnsavedChanges(true)}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">Organization &amp; Report Branding</h2>
                <p className="text-xs text-slate-500">
                  Shown at the header and footer of student diagnostic results.
                </p>
              </div>
              {settingsSavedMessage && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  <span>Saved!</span>
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Marketing Slogan / Footer Note
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. Master SAT & ACT Math with targeted diagnostic courses"
                className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Contact Phone
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 019-2834"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp Contact Link
                </label>
                <input
                  type="text"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="https://wa.me/15550192834"
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="px-4 py-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition"
            >
              {savingSettings ? 'Saving...' : 'Save Organization Details'}
            </button>
          </form>
        </div>

        {/* RIGHT COLUMN: Interactive Live Intake Preview (5 cols) */}
        <div className="lg:col-span-5 min-w-0">
          <div className="sticky top-20 bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Student Intake Live Preview</h3>
                  <p className="text-[10px] text-slate-400">
                    Active fields visible to students before testing
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {fields.filter((f) => f.is_active).length} Active
              </span>
            </div>

            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {fields.filter((f) => f.is_active).length === 0 ? (
                <p className="text-xs text-slate-400 py-6 text-center">
                  No active registration fields to preview. All fields are currently hidden.
                </p>
              ) : (
                fields
                  .filter((f) => f.is_active)
                  .map((field) => (
                    <DynamicRegistrationField
                      key={field.id}
                      field={field}
                      value={previewValues[field.field_key] ?? ''}
                      onChange={(val) =>
                        setPreviewValues((prev) => ({ ...prev, [field.field_key]: val }))
                      }
                    />
                  ))
              )}

              <button
                type="button"
                disabled
                className="w-full bg-blue-600 text-white text-xs font-semibold py-2.5 rounded-xl opacity-80 cursor-not-allowed mt-2"
              >
                Start Assessment →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create / Edit Field Modal */}
      {modalMode !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {modalMode === 'create' ? 'Add Registration Field' : 'Edit Registration Field'}
              </h2>
              <button
                type="button"
                onClick={closeFieldEditor}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            {fieldError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{fieldError}</span>
              </div>
            )}

            <form
              onSubmit={handleSaveField}
              onChangeCapture={() => setHasUnsavedChanges(true)}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Label <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Current Grade Level"
                  value={fieldLabel}
                  onChange={(e) => handleLabelChange(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Field Key (ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. current_grade"
                  value={fieldKey}
                  onChange={(e) => setFieldKey(slugify(e.target.value))}
                  className="w-full text-xs font-mono border border-slate-300 rounded-xl px-3 py-2.5 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Field Type</label>
                <select
                  value={fieldType}
                  onChange={(e) => setFieldType(e.target.value as FieldType)}
                  className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2.5 bg-white focus:border-blue-500 focus:outline-none"
                >
                  {Object.entries(FIELD_TYPE_LABELS).map(([val, lbl]) => (
                    <option key={val} value={val}>
                      {lbl}
                    </option>
                  ))}
                </select>
              </div>

              {['dropdown', 'radio', 'checkbox'].includes(fieldType) && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Options (one per line) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={optionsText}
                    onChange={(e) => setOptionsText(e.target.value)}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    className="w-full text-xs border border-slate-300 rounded-xl px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isRequiredField"
                  checked={isRequired}
                  onChange={(e) => setIsRequired(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isRequiredField" className="text-xs text-slate-700 cursor-pointer">
                  Require student to fill this field before starting assessment
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeFieldEditor}
                  className="px-4 py-2 border border-slate-200 text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingField}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl transition"
                >
                  {savingField ? 'Saving...' : 'Save Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* In-app Field Delete Confirmation Modal */}
      {fieldToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
          role="dialog"
        >
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Delete Registration Field</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Are you sure you want to remove <strong className="text-slate-800">"{fieldToDelete.label}"</strong>?
                Historical test responses will still be preserved.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setFieldToDelete(null)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 rounded-xl text-xs font-semibold text-white transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
