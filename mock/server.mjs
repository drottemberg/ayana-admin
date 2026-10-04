import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const dbPath = new URL('./db.json', import.meta.url)
const port = Number.parseInt(process.env.PORT ?? '3001', 10)
const host = process.env.HOST ?? 'localhost'

async function readDb() {
  return JSON.parse(await readFile(dbPath, 'utf-8'))
}

async function writeDb(data) {
  await writeFile(dbPath, `${JSON.stringify(data, null, 2)}\n`)
}

function sendJson(response, status, data) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(data))
}

function getBody(request) {
  return new Promise((resolve, reject) => {
    let body = ''

    request.on('data', (chunk) => {
      body += chunk
    })
    request.on('end', () => {
      if (!body) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function matchesQuery(item, searchParams) {
  return Array.from(searchParams.entries()).every(([key, value]) => {
    if (key.startsWith('_')) return true

    return String(item[key] ?? '') === value
  })
}

function getDeviceDetail(db, device) {
  return {
    ...(db.deviceDetails ?? {}),
    ...getDeviceWithTypeNames(db, device),
  }
}

function getDeviceWithTypeNames(db, device) {
  const deviceTypes = Array.isArray(db.deviceTypes) ? db.deviceTypes : []
  const normalizeType = (type) => {
    if (typeof type === 'object' && type !== null) return type

    return deviceTypes.find((deviceType) => deviceType.id === type) ?? { id: type, name: String(type) }
  }

  return {
    ...device,
    type: Array.isArray(device.type) ? normalizeType(device.type[0]) : normalizeType(device.type),
    deviceItems: Array.isArray(device.deviceItems)
      ? device.deviceItems.map((item) => getDeviceWithTypeNames(db, item))
      : undefined,
  }
}

function getCollection(db, collectionName) {
  const collection = db[collectionName]
  return Array.isArray(collection) ? collection : null
}

const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host}`)
    const [collectionName, id] = url.pathname.split('/').filter(Boolean)
    const db = await readDb()
    const collection = collectionName ? getCollection(db, collectionName) : null

    if (!collectionName) {
      sendJson(
        response,
        200,
        Object.fromEntries(
          Object.entries(db)
            .filter(([, value]) => Array.isArray(value))
            .map(([key]) => [key, `/${key}`]),
        ),
      )
      return
    }

    if (!collection) {
      sendJson(response, 404, { error: 'Not Found' })
      return
    }

    if (request.method === 'GET' && !id) {
      const items = collection.filter((item) => matchesQuery(item, url.searchParams))

      sendJson(
        response,
        200,
        collectionName === 'devices' ? items.map((item) => getDeviceWithTypeNames(db, item)) : items,
      )
      return
    }

    if (request.method === 'GET' && id) {
      const item = collection.find((entry) => String(entry.id) === id)

      if (!item) {
        sendJson(response, 404, { error: 'Not Found' })
        return
      }

      sendJson(response, 200, collectionName === 'devices' ? getDeviceDetail(db, item) : item)
      return
    }

    if (request.method === 'POST' && !id) {
      const payload = await getBody(request)
      const item = {
        id: payload.id ?? randomUUID(),
        ...payload,
      }

      collection.push(item)
      await writeDb(db)
      sendJson(response, 201, item)
      return
    }

    if ((request.method === 'PATCH' || request.method === 'PUT') && id) {
      const itemIndex = collection.findIndex((entry) => String(entry.id) === id)

      if (itemIndex === -1) {
        sendJson(response, 404, { error: 'Not Found' })
        return
      }

      const payload = await getBody(request)
      const nextItem = request.method === 'PATCH' ? { ...collection[itemIndex], ...payload } : { id, ...payload }

      collection[itemIndex] = nextItem
      await writeDb(db)
      sendJson(response, 200, nextItem)
      return
    }

    if (request.method === 'DELETE' && id) {
      const itemIndex = collection.findIndex((entry) => String(entry.id) === id)

      if (itemIndex === -1) {
        sendJson(response, 404, { error: 'Not Found' })
        return
      }

      const [deletedItem] = collection.splice(itemIndex, 1)
      await writeDb(db)
      sendJson(response, 200, deletedItem)
      return
    }

    sendJson(response, 404, { error: 'Not Found' })
  } catch (error) {
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'Server error' })
  }
})

server.listen(port, host, () => {
  console.log(`Mock API running at http://${host}:${port}`)
})
