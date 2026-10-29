// POST /uploads        -> firma una URL de subida (PUT), caduca en 5 min
// GET  /uploads/{proxy+} -> firma una URL de lectura (GET), caduca en 1 hora
//
// La imagen no pasa por la Lambda: el navegador pide una URL firmada, sube
// directo a S3 y guarda solo la imageKey en el elemento. El bucket es
// privado, asi que ver la imagen tambien necesita una URL firmada.

import { randomUUID } from 'node:crypto'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// WHEN_REQUIRED para no firmar el checksum de un cuerpo vacio en la URL de
// PUT: el navegador sube el cuerpo, no la Lambda.
const s3 = new S3Client({ requestChecksumCalculation: 'WHEN_REQUIRED' })
const BUCKET = process.env.BUCKET

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function respuesta(statusCode, cuerpo) {
  return { statusCode, headers: CORS, body: JSON.stringify(cuerpo) }
}

// contentType de imagen permitido -> extension del archivo.
const EXTENSIONES = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export async function handler(event) {
  // --- Firma de lectura (GET /uploads/<imageKey>) ---------------------
  if (event.httpMethod === 'GET') {
    const imageKey = event.pathParameters?.proxy
    if (!imageKey) {
      return respuesta(400, { error: 'Falta la imageKey.' })
    }
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: imageKey }),
      { expiresIn: 3600 },
    )
    return respuesta(200, { url })
  }

  // --- Firma de subida (POST /uploads) --------------------------------
  let cuerpo = {}
  try {
    cuerpo = event.body ? JSON.parse(event.body) : {}
  } catch {
    return respuesta(400, { error: 'El cuerpo no es JSON valido.' })
  }

  const { altarId, contentType } = cuerpo
  if (!altarId) {
    return respuesta(400, { error: 'Falta altarId.' })
  }

  const ext = EXTENSIONES[contentType]
  if (!ext) {
    return respuesta(400, { error: 'Ese contentType no es una imagen.' })
  }

  const imageKey = `${altarId}/${randomUUID()}.${ext}`
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: imageKey, ContentType: contentType }),
    { expiresIn: 300 },
  )
  return respuesta(200, { url, imageKey })
}
