// El stack del altar.
//
// La tabla, el bucket privado, las tres Lambdas y la REST API con cuatro
// rutas. Cada Lambda recibe permisos de datos acotados a SU recurso (la
// tabla o el bucket): nada de FullAccess ni Resource '*'. La policy basica
// que CDK agrega para escribir logs en CloudWatch es esperada.
//
// JavaScript plano con Code.fromAsset('lambda'): el codigo que escribes es
// el que corre. Nada de NodejsFunction.

import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'

export class OfrendaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // --- La tabla de DynamoDB -------------------------------------------
    // partition key altarId, sort key sk = <creadoEn>#<id>. Un Query por
    // altarId devuelve los elementos en el orden en que se pusieron.
    const tabla = new dynamodb.Table(this, 'Elementos', {
      tableName: 'ofrenda-elementos',
      partitionKey: { name: 'altarId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    })

    // --- El bucket privado de S3 ----------------------------------------
    // Privado: una imagen solo se ve con una URL firmada. CORS para PUT
    // desde cualquier origen (la firma lleva la autorizacion).
    const bucket = new s3.Bucket(this, 'Imagenes', {
      bucketName: `ofrenda-imagenes-${cdk.Aws.ACCOUNT_ID}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
    })

    // --- Las tres Lambdas -----------------------------------------------
    // JavaScript plano desde lambda/. El SDK de AWS v3 ya viene en el
    // runtime, asi que no viaja en el paquete.
    const comun = {
      runtime: lambda.Runtime.NODEJS_24_X,
      code: lambda.Code.fromAsset('lambda'),
      memorySize: 128,
      timeout: cdk.Duration.seconds(10),
    }

    const listar = new lambda.Function(this, 'Listar', {
      ...comun,
      handler: 'listar.handler',
      environment: { TABLA: tabla.tableName },
    })
    tabla.grantReadData(listar)

    const agregar = new lambda.Function(this, 'Agregar', {
      ...comun,
      handler: 'agregar.handler',
      environment: { TABLA: tabla.tableName },
    })
    tabla.grantReadWriteData(agregar)

    const subir = new lambda.Function(this, 'Subir', {
      ...comun,
      handler: 'subir.handler',
      environment: { BUCKET: bucket.bucketName },
    })
    bucket.grantPut(subir)
    bucket.grantRead(subir)

    // --- La REST API con cuatro rutas -----------------------------------
    const api = new apigateway.RestApi(this, 'Api', {
      restApiName: 'ofrenda',
      deployOptions: { stageName: 'v1' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST'],
        allowHeaders: ['Content-Type'],
      },
    })

    // GET /elements?altarId=...  y  POST /elements (crear y borrar)
    const elements = api.root.addResource('elements')
    elements.addMethod('GET', new apigateway.LambdaIntegration(listar))
    elements.addMethod('POST', new apigateway.LambdaIntegration(agregar))

    // POST /uploads (firma de subida) y GET /uploads/{proxy+} (firma de
    // lectura). El proxy greedy deja pasar la imageKey, que lleva un '/'.
    const uploads = api.root.addResource('uploads')
    uploads.addMethod('POST', new apigateway.LambdaIntegration(subir))
    const uploadsProxy = uploads.addResource('{proxy+}')
    uploadsProxy.addMethod('GET', new apigateway.LambdaIntegration(subir))

    // La base de la API. Esta URL va en Amplify como VITE_API_URL.
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url })
  }
}
