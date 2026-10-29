// POST /elements
//
// Crea un elemento, o lo borra si el cuerpo trae { borrar: true, id }. Se
// usa la misma ruta para mantener corto el contrato del taller.
//
// Al crear, la API pone id, creadoEn, posicion y sk; solo acepta del
// cliente tipo, nivel, texto, link, puestoPor e imageKey. Cualquier otro
// campo (incluida una posicion mandada por el cliente) se ignora.

import { randomUUID } from 'node:crypto'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLA = process.env.TABLA

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function respuesta(statusCode, cuerpo) {
  return { statusCode, headers: CORS, body: JSON.stringify(cuerpo) }
}

// Los unicos campos que la API acepta del cliente.
const CAMPOS = ['tipo', 'nivel', 'texto', 'link', 'puestoPor', 'imageKey']

export async function handler(event) {
  let cuerpo = {}
  try {
    cuerpo = event.body ? JSON.parse(event.body) : {}
  } catch {
    return respuesta(400, { error: 'El cuerpo no es JSON valido.' })
  }

  const { altarId } = cuerpo
  if (!altarId) {
    return respuesta(400, { error: 'Falta altarId.' })
  }

  // --- Borrar ---------------------------------------------------------
  if (cuerpo.borrar === true) {
    const { id } = cuerpo
    if (!id) {
      return respuesta(400, { error: 'Falta id.' })
    }

    const { Items = [] } = await doc.send(
      new QueryCommand({
        TableName: TABLA,
        KeyConditionExpression: 'altarId = :a',
        FilterExpression: 'id = :id',
        ExpressionAttributeValues: { ':a': altarId, ':id': id },
      }),
    )

    if (Items.length === 0) {
      return respuesta(404, { error: 'Ese elemento no existe en este altar.' })
    }

    await doc.send(
      new DeleteCommand({
        TableName: TABLA,
        Key: { altarId, sk: Items[0].sk },
      }),
    )
    return respuesta(200, { borrado: id })
  }

  // --- Crear ----------------------------------------------------------
  if (!cuerpo.tipo) {
    return respuesta(400, { error: 'Falta tipo.' })
  }

  // Solo los campos permitidos; el resto se ignora.
  const limpio = {}
  for (const campo of CAMPOS) {
    if (cuerpo[campo] !== undefined) limpio[campo] = cuerpo[campo]
  }

  // Cuantos hay ya en ese nivel: esa es la posicion.
  const { Items = [] } = await doc.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: 'altarId = :a',
      FilterExpression: 'nivel = :n',
      ExpressionAttributeValues: { ':a': altarId, ':n': limpio.nivel },
    }),
  )

  const id = randomUUID()
  const creadoEn = new Date().toISOString()
  const elemento = {
    ...limpio,
    altarId,
    id,
    creadoEn,
    posicion: Items.length,
  }

  await doc.send(
    new PutCommand({
      TableName: TABLA,
      Item: { ...elemento, sk: `${creadoEn}#${id}` },
    }),
  )

  return respuesta(201, elemento)
}
