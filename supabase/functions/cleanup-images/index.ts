// cleanup-images — borra imágenes de Cloudinary y nullifica URLs en DB
// Body: { tipo: 'comprobantes' | 'flamitas' | 'fotos', dry_run?: boolean }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CLOUD       = Deno.env.get('CLOUDINARY_CLOUD_NAME')!
const API_KEY     = Deno.env.get('CLOUDINARY_API_KEY')!
const API_SECRET  = Deno.env.get('CLOUDINARY_API_SECRET')!
const SUPA_URL    = Deno.env.get('SUPABASE_URL')!
const SUPA_KEY    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPA_URL, SUPA_KEY)

// Borra hasta 100 resources de Cloudinary en un llamado
async function cloudinaryDelete(publicIds: string[]): Promise<{ deleted: Record<string, string> }> {
  const auth   = btoa(`${API_KEY}:${API_SECRET}`)
  const params = new URLSearchParams()
  publicIds.forEach(id => params.append('public_ids[]', id))

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/resources/image`,
    {
      method:  'DELETE',
      headers: { Authorization: `Basic ${auth}` },
      body:    params,
    }
  )
  return res.json()
}

async function bulkDelete(publicIds: string[]) {
  const results: Record<string, string>[] = []
  // Cloudinary permite hasta 100 IDs por request
  for (let i = 0; i < publicIds.length; i += 100) {
    const batch = publicIds.slice(i, i + 100)
    const r = await cloudinaryDelete(batch)
    results.push(r.deleted ?? {})
  }
  return results
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' } })
  }

  let body: { tipo: string; dry_run?: boolean }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tipo, dry_run = false } = body
  if (!['comprobantes', 'flamitas', 'fotos'].includes(tipo)) {
    return Response.json({ error: 'tipo debe ser comprobantes | flamitas | fotos' }, { status: 400 })
  }

  const CUTOFF_90D = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const CUTOFF_1Y  = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()

  // ── comprobantes ────────────────────────────────────────────────────────────
  if (tipo === 'comprobantes') {
    const { data, error } = await supabase
      .from('pedidos')
      .select('id, comprobante_public_id')
      .eq('estado', 'entregado')
      .lt('created_at', CUTOFF_90D)
      .not('comprobante_public_id', 'is', null)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    const rows = data ?? []
    if (dry_run) return Response.json({ count: rows.length })

    const ids      = rows.map(r => r.id as string)
    const pubIds   = rows.map(r => r.comprobante_public_id as string)
    await bulkDelete(pubIds)
    await supabase.from('pedidos')
      .update({ comprobante_url: null, comprobante_public_id: null })
      .in('id', ids)

    return Response.json({ deleted: rows.length })
  }

  // ── flamitas (puntos_carreras) ───────────────────────────────────────────────
  if (tipo === 'flamitas') {
    const { data, error } = await supabase
      .from('puntos_carreras')
      .select('id, foto_public_id, foto_public_id_anterior')
      .lt('created_at', CUTOFF_1Y)
      .not('foto_public_id', 'is', null)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    const rows = data ?? []
    if (dry_run) return Response.json({ count: rows.length })

    const ids    = rows.map(r => r.id as string)
    const pubIds = [
      ...rows.map(r => r.foto_public_id as string),
      ...rows.filter(r => r.foto_public_id_anterior).map(r => r.foto_public_id_anterior as string),
    ]
    await bulkDelete(pubIds)
    await supabase.from('puntos_carreras')
      .update({ foto_url: null, foto_public_id: null, foto_url_anterior: null, foto_public_id_anterior: null })
      .in('id', ids)

    return Response.json({ deleted: rows.length })
  }

  // ── fotos_carreras ──────────────────────────────────────────────────────────
  if (tipo === 'fotos') {
    const { data, error } = await supabase
      .from('fotos_carreras')
      .select('id, cloudinary_public_id')
      .lt('created_at', CUTOFF_1Y)
      .not('cloudinary_public_id', 'is', null)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    const rows = data ?? []
    if (dry_run) return Response.json({ count: rows.length })

    const ids    = rows.map(r => r.id as string)
    const pubIds = rows.map(r => r.cloudinary_public_id as string)
    await bulkDelete(pubIds)
    await supabase.from('fotos_carreras').delete().in('id', ids)

    return Response.json({ deleted: rows.length })
  }

  return Response.json({ error: 'Unknown tipo' }, { status: 400 })
})
