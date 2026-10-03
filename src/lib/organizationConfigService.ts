import { supabase } from './supabaseClient'

export interface StaffOrganizationContext {
  userId: string
  organizationId: string
}

export async function getStaffOrganizationContext(): Promise<StaffOrganizationContext> {
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) throw new Error('Sign in as an organization staff member.')

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.organization_id) {
    throw new Error(profileError?.message || 'Your account is not linked to an organization.')
  }

  const role = String(profile.role || '').trim().toLowerCase()
  if (role !== 'admin' && role !== 'teacher') {
    throw new Error('Only organization admins and teachers can manage app settings.')
  }

  return { userId: user.id, organizationId: profile.organization_id }
}

export async function loadOrganizationConfig<T>(
  configKey: string,
  assessmentId?: string
): Promise<T | null> {
  const { organizationId } = await getStaffOrganizationContext()
  let query = supabase
    .from('organization_app_configs')
    .select('config_data')
    .eq('organization_id', organizationId)
    .eq('config_key', configKey)
  query = assessmentId ? query.eq('assessment_id', assessmentId) : query.is('assessment_id', null)

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  return (data?.config_data as T | undefined) ?? null
}

export async function saveOrganizationConfig(
  configKey: string,
  configData: unknown,
  assessmentId?: string
): Promise<void> {
  const { userId, organizationId } = await getStaffOrganizationContext()
  let query = supabase
    .from('organization_app_configs')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('config_key', configKey)
  query = assessmentId ? query.eq('assessment_id', assessmentId) : query.is('assessment_id', null)

  const { data: existing, error: lookupError } = await query.maybeSingle()
  if (lookupError) throw lookupError

  const values = {
    organization_id: organizationId,
    assessment_id: assessmentId || null,
    config_key: configKey,
    config_data: configData,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }
  const { error } = existing?.id
    ? await supabase.from('organization_app_configs').update(values).eq('id', existing.id)
    : await supabase.from('organization_app_configs').insert(values)
  if (error) throw error
}

export async function deleteOrganizationConfig(configKey: string, assessmentId?: string): Promise<void> {
  const { organizationId } = await getStaffOrganizationContext()
  let query = supabase
    .from('organization_app_configs')
    .delete()
    .eq('organization_id', organizationId)
    .eq('config_key', configKey)
  query = assessmentId ? query.eq('assessment_id', assessmentId) : query.is('assessment_id', null)
  const { error } = await query
  if (error) throw error
}