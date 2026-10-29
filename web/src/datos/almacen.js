// Donde se guarda el altar.
//
// ---------------------------------------------------------------------
//  ESTE ES EL UNICO ARCHIVO QUE CAMBIA EN EL MODULO 3.
// ---------------------------------------------------------------------
//
// Antes todo vivia en el localStorage de ESTE navegador. Ahora este archivo
// le habla a tu propia API: DynamoDB para los elementos, S3 para las
// imagenes. Las cuatro funciones de abajo mantienen su firma y siguen
// siendo async, asi que los componentes no se tocan ni una linea.
//
// `agregar` sigue recibiendo el File crudo de la imagen y lo procesa AQUI:
// antes lo guardaba como data URL, ahora lo sube a S3 con una URL firmada y
// guarda solo la `imageKey`. El componente nunca sabe que paso con el
// archivo: solo lo entrega.

import { reducirABlob } from '../lib/imagen.js'

// El banner de la pagina tiene que decir lo que ESTE archivo hace de
// verdad. Ahora el altar vive en la nube.
export const MODO = 'nube'

// La URL de la API sale de la variable de entorno (nunca escrita en el
// codigo) y se normaliza sin diagonal final.
const API = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

// La URL de Amplify identifica el altar: la laptop y el telefono abren el
// mismo hostname, asi que consultan la misma particion.
const altarId = window.location.hostname

// Para la importacion de la primera carga: los elementos que la version de
// navegador dejo guardados en este equipo.
const LLAVE = 'ofrenda:elementos'
const LLAVE_NOMBRE = 'ofrenda:nombre'

function url(ruta) {
  return `${API}${ruta}`
}

async function pedir(ruta, opciones) {
  const respuesta = await fetch(url(ruta), opciones)
  if (!respuesta.ok) {
    let detalle = ''
    try {
      detalle = (await respuesta.json()).error || ''
    } catch {
      // Sin cuerpo util; nos quedamos con el status.
    }
    throw new Error(detalle || `La API respondio ${respuesta.status}.`)
  }
  return respuesta.json()
}

/** Todos los elementos del altar, en el orden en que se pusieron. */
export async function listar() {
  const { elementos } = await pedir(`/elements?altarId=${encodeURIComponent(altarId)}`)
  // En la primera carga desde la laptop, si la API esta vacia, subimos lo
  // que ya existe en este navegador para no empezar en blanco.
  if (elementos.length === 0) {
    const importados = await importarDesdeLocalStorage()
    if (importados.length > 0) return importados
  }
  return elementos
}

/**
 * Agrega un elemento y devuelve como quedo guardado.
 *
 * Si trae `imagen` (el File del formulario), aqui se reduce y se sube a S3;
 * el elemento solo guarda la `imageKey`. El componente nunca sabe que paso
 * con el archivo: solo lo entrega.
 */
export async function agregar(elemento) {
  const { imagen, ...resto } = elemento
  let imageKey
  if (imagen) {
    const blob = await reducirABlob(imagen)
    imageKey = await subirImagen(blob)
  }
  return crear({ ...resto, ...(imageKey ? { imageKey } : {}) })
}

/** Quita un elemento del altar. */
export async function borrar(id) {
  await pedir('/elements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ altarId, borrar: true, id }),
  })
}

/**
 * De donde sale la imagen de un elemento.
 *
 * El elemento solo guarda su `imageKey`. Aqui se pide la URL firmada de
 * lectura a la API. Un elemento sin imagen devuelve null.
 */
export async function urlDeImagen(elemento) {
  if (!elemento.imageKey) return null
  const { url: firmada } = await pedir(`/uploads/${elemento.imageKey}`)
  return firmada
}

/** Quien esta poniendo cosas en el altar. Se pregunta una sola vez. */
export function nombre() {
  return localStorage.getItem(LLAVE_NOMBRE) || ''
}

export function guardarNombre(valor) {
  localStorage.setItem(LLAVE_NOMBRE, valor.slice(0, 40))
}

// --- Internos ---------------------------------------------------------

/** Crea un elemento en la API (POST /elements) y devuelve el guardado. */
async function crear(datos) {
  return pedir('/elements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...datos, altarId }),
  })
}

/** Pide una URL firmada, sube el blob a S3 y devuelve la imageKey. */
async function subirImagen(blob) {
  const { url: firmada, imageKey } = await pedir('/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ altarId, contentType: blob.type }),
  })
  const subida = await fetch(firmada, {
    method: 'PUT',
    headers: { 'Content-Type': blob.type },
    body: blob,
  })
  if (!subida.ok) {
    throw new Error('No pude subir la imagen a S3.')
  }
  return imageKey
}

/**
 * Primera carga desde la laptop: si la API esta vacia, importa los
 * elementos que la version de navegador dejo en `ofrenda:elementos`,
 * incluidas las imagenes guardadas como data URL.
 */
async function importarDesdeLocalStorage() {
  let locales = []
  try {
    const crudo = localStorage.getItem(LLAVE)
    locales = crudo ? JSON.parse(crudo) : []
  } catch {
    return []
  }
  if (!Array.isArray(locales) || locales.length === 0) return []

  const guardados = []
  for (const local of locales) {
    const { id, creadoEn, posicion, imagenLocal, ...resto } = local
    let imageKey
    if (imagenLocal) {
      const blob = await (await fetch(imagenLocal)).blob()
      imageKey = await subirImagen(blob)
    }
    guardados.push(await crear({ ...resto, ...(imageKey ? { imageKey } : {}) }))
  }
  return guardados
}
