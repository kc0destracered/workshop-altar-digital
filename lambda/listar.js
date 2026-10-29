// GET /elements?altarId=...
//
// Query por altarId, ascendente, con Limit. Nunca un Scan. Quita `sk` de
// cada item antes de devolver { elementos }.

import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb'

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLA = process.env.TABLA

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
}

function respuesta(statusCode, cuerpo) {
  return { statusCode, headers: CORS, body: JSON.stringify(cuerpo) }
}

export async function handler(event) {
  const altarId = event.queryStringParameters?.altarId
  if (!altarId) {
    return respuesta(400, { error: 'Falta altarId.' })
  }

  const { Items = [] } = await doc.send(
    new QueryCommand({
      TableName: TABLA,
      KeyConditionExpression: 'altarId = :a',
      ExpressionAttributeValues: { ':a': altarId },
      ScanIndexForward: true,
      Limit: 200,
    }),
  )

  const elementos = Items.map(({ sk, ...resto }) => resto)
  return respuesta(200, { elementos })
}
