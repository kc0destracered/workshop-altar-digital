# Implementation Plan

## Overview

Cada tarea es un módulo del workshop. Quien la ejecuta está aprendiendo y va a
leer el diff antes de aceptarlo, así que haz cambios chicos y fáciles de revisar.
No corras comandos de deploy en ninguna tarea.

## Task Dependency Graph

La tarea 1 (backend) y la tarea 2 (un tipo nuevo) son independientes: la 2 solo
toca el frontend. Se pueden hacer en cualquier orden, aunque el taller pide la 1
en el módulo 3 y la 2 en el módulo 4.

```json
{
  "waves": [
    { "wave": 1, "tasks": [1, 2], "dependsOn": [] }
  ]
}
```

```text
1 (backend, modulo 3)
2 (frontend, modulo 4)   independientes entre si
```

## Tasks

- [x] 1. Escribir el backend y mover el altar a la nube (módulo 3)
  - Escribe `infra/ofrenda-stack.ts` siguiendo **Architecture**, **Data Models** y
    **Components and Interfaces** de `design.md`: la tabla, el bucket privado, las
    tres Lambdas con permisos acotados a sus recursos y la REST API con cuatro rutas.
  - Escribe los tres handlers en `lambda/` (`listar.js`, `agregar.js`,
    `subir.js`) siguiendo la sección **Los handlers** de `design.md`, en
    JavaScript plano con `import` (ESM).
  - Crea `lambda/package.json` con `{ "type": "module" }`. Sin él las Lambdas no
    cargan.
  - Reescribe únicamente `web/src/datos/almacen.js` para usar la API. Mantén las
    firmas de `listar`, `agregar`, `borrar` y `urlDeImagen`, y cambia `MODO` a
    `'nube'`.
  - Usa el hostname de la página como `altarId`, para que la misma URL abra el
    mismo altar en la laptop y en el teléfono. En la primera carga desde la
    laptop, si la API está vacía, importa los elementos de `ofrenda:elementos`
    que ya existen en `localStorage`, incluidas sus imágenes.
  - No uses `NodejsFunction`. No agregues policies de datos con `Resource: '*'`
    ni policies `FullAccess`: cada Lambda queda acotada a la tabla o al bucket.
    La policy básica que CDK agrega para escribir logs en CloudWatch es esperada.
  - No agregues dependencias: el SDK de AWS v3 ya viene en el runtime.
  - Al terminar, corre `npm run synth` y `npm run build`. Solo validan; no
    despliegan. El asistente revisa el diff y ejecuta el deploy.
  - _Requisitos: 1, 2, 3, 4, 5_

- [x] 2. Agregar un tipo de elemento nuevo (módulo 4)
  - Agrega un valor nuevo de `tipo` en `web/src/catalogo/elementos.js` (su etiqueta, grupo,
    nivel sugerido) y su dibujo en `web/src/catalogo/arte.js`, siguiendo el estilo de los que
    ya existen.
  - Solo toca el frontend. NO toques `infra/`, `lambda/` ni el contrato de la
    API: un tipo nuevo es texto libre para la tabla.
  - Al terminar, corre `npm run dev` y confirma que el tipo nuevo aparece en el
    formulario y se dibuja en el altar.
  - _Requisitos: 6_
