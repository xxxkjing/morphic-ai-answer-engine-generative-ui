// app/page.tsx
import { redirect } from 'next/navigation'
import { generateId } from 'ai'

import { createClient } from '@/lib/supabase/server'
import { getModels } from '@/lib/config/models'

import { Chat } from '@/components/chat'

export default async function Page() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const id = generateId()
  const models = await getModels()
  return <Chat id={id} models={models} />
}