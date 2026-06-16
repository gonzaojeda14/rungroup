// Edge Function: sync-weather
// Obtiene el pronóstico del clima para una carrera usando OpenWeatherMap.
// Geocodifica el campo `lugar` y busca el forecast más cercano al horario de la carrera.
// Cachea el resultado en carreras.weather_data por 1 hora.
//
// Body: { carrera_id: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL     = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OWM_API_KEY      = Deno.env.get('OWM_API_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function normalizarLugar(lugar: string): string[] {
  // Normalizar abreviaturas argentinas y generar variantes para geocoding
  const normalizado = lugar
    .replace(/\bCABA\b/gi, 'Buenos Aires')
    .replace(/\bGBA\b/gi, 'Buenos Aires')
    .replace(/\bPBA\b/gi, 'Buenos Aires')
    .replace(/\bBsAs\b/gi, 'Buenos Aires')

  const primeraParte = normalizado.split(',')[0].trim()

  return [
    `${normalizado}, Argentina`,
    `${normalizado}`,
    `${primeraParte}, Argentina`,
    `${primeraParte}`,
  ].filter((v, i, arr) => arr.indexOf(v) === i) // deduplicar
}

async function fetchWeather(lugar: string, fecha: string, hora: string | null) {
  // 1. Geocodificar el lugar con múltiples variantes
  let geoData: any[] = []
  for (const q of normalizarLugar(lugar)) {
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${OWM_API_KEY}`
    const geoRes = await fetch(geoUrl)
    geoData = await geoRes.json()
    console.log(`[geo] q="${q}" → ${geoData?.length ? geoData[0].name + ', ' + geoData[0].country : 'no results'}`)
    if (geoData?.length) break
  }
  if (!geoData?.length) {
    console.error('[geo] No se encontró el lugar:', lugar)
    return null
  }

  const { lat, lon } = geoData[0]

  // 2. Obtener pronóstico (5 días, cada 3h)
  const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OWM_API_KEY}&units=metric&lang=es&cnt=40`
  const forecastRes = await fetch(forecastUrl)
  const forecast = await forecastRes.json()
  console.log(`[forecast] status=${forecast?.cod}, entries=${forecast?.list?.length}`)
  if (!forecast?.list?.length) return null

  // 3. Encontrar la entrada más cercana al horario de la carrera
  const targetTime = new Date(`${fecha}T${hora ? hora.substring(0, 5) : '08:00'}:00`)

  let closest = forecast.list[0]
  let minDiff = Infinity
  for (const entry of forecast.list) {
    const diff = Math.abs(new Date(entry.dt * 1000).getTime() - targetTime.getTime())
    if (diff < minDiff) { minDiff = diff; closest = entry }
  }

  return {
    temp: Math.round(closest.main.temp),
    feels_like: Math.round(closest.main.feels_like),
    humidity: closest.main.humidity,
    rain_prob: Math.round((closest.pop || 0) * 100),
    wind_kmh: Math.round(closest.wind.speed * 3.6),
    condition: closest.weather[0].description,
    icon: closest.weather[0].icon,
    hora_pronostico: closest.dt_txt,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors })

  try {
    const { carrera_id } = await req.json()
    if (!carrera_id) return json({ error: 'Falta carrera_id' }, 400)

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: carrera } = await supabase
      .from('carreras')
      .select('id, lugar, fecha, hora, weather_data, weather_updated_at')
      .eq('id', carrera_id)
      .single()

    if (!carrera?.lugar) return json({ error: 'La carrera no tiene ubicación' }, 400)

    // Verificar caché (1 hora)
    const isStale = !carrera.weather_updated_at ||
      new Date(carrera.weather_updated_at) < new Date(Date.now() - 60 * 60 * 1000)

    if (!isStale && carrera.weather_data) {
      return json({ weather: carrera.weather_data, cached: true })
    }

    const weather = await fetchWeather(carrera.lugar, carrera.fecha, carrera.hora)
    if (!weather) return json({ error: 'No se pudo obtener el pronóstico', lugar: carrera.lugar }, 500)

    await supabase.from('carreras').update({
      weather_data: weather,
      weather_updated_at: new Date().toISOString(),
    }).eq('id', carrera.id)

    return json({ weather, cached: false })

  } catch (err) {
    console.error('[sync-weather]', err)
    return json({ error: String(err) }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'content-type': 'application/json' },
  })
}
