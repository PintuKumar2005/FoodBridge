import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 4000)
const HOST = process.env.HOST ?? '127.0.0.1'
const OTP_CODE = '123456'

const donors = []
const receivers = []
const otps = new Map()

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Access-Control-Allow-Origin': process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(payload))
}

function readJson(request) {
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

function normalizePhone(phone = '') {
  return String(phone).replace(/\D/g, '').slice(-10)
}

function requireFields(payload, fields) {
  const missing = fields.filter((field) => !String(payload[field] ?? '').trim())

  if (missing.length > 0) {
    return `Missing required field: ${missing.join(', ')}`
  }

  return null
}

function publicUser(user) {
  return {
    id: user.id,
    type: user.type,
    email: user.email,
    name: user.name,
    organizationName: user.organizationName,
    organizationType: user.organizationType,
    phone: user.phone,
  }
}

function findUser(role, phone) {
  const collection = role === 'donor' ? donors : receivers
  return collection.find((user) => user.phone === phone)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`)

  if (request.method === 'OPTIONS') {
    sendJson(response, 204, {})
    return
  }

  try {
    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, { ok: true, donors: donors.length, receivers: receivers.length })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/donors') {
      const payload = await readJson(request)
      const validationError = requireFields(payload, ['businessName', 'businessType', 'ownerName', 'phone', 'email', 'address', 'city', 'state', 'pincode'])

      if (validationError) {
        sendJson(response, 400, { message: validationError })
        return
      }

      const phone = normalizePhone(payload.phone)
      const existing = findUser('donor', phone)

      if (existing) {
        sendJson(response, 409, { message: 'A donor with this phone number already exists' })
        return
      }

      const user = {
        ...payload,
        id: randomUUID(),
        type: 'donor',
        phone,
        name: String(payload.ownerName),
        organizationName: String(payload.businessName),
        organizationType: String(payload.businessType),
        createdAt: new Date().toISOString(),
      }

      donors.push(user)
      sendJson(response, 201, { message: 'Donor registered successfully', user: publicUser(user) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/receivers') {
      const payload = await readJson(request)
      const validationError = requireFields(payload, ['organizationName', 'organizationType', 'contactName', 'phone', 'email', 'address', 'city', 'state', 'pincode'])

      if (validationError) {
        sendJson(response, 400, { message: validationError })
        return
      }

      const phone = normalizePhone(payload.phone)
      const existing = findUser('receiver', phone)

      if (existing) {
        sendJson(response, 409, { message: 'A receiver with this phone number already exists' })
        return
      }

      const user = {
        ...payload,
        id: randomUUID(),
        type: 'receiver',
        phone,
        name: String(payload.contactName),
        createdAt: new Date().toISOString(),
      }

      receivers.push(user)
      sendJson(response, 201, { message: 'Receiver registered successfully', user: publicUser(user) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/send-otp') {
      const payload = await readJson(request)
      const role = payload.role === 'receiver' ? 'receiver' : 'donor'
      const phone = normalizePhone(payload.phone)

      if (!phone) {
        sendJson(response, 400, { message: 'Phone number is required' })
        return
      }

      const user = findUser(role, phone)

      if (!user) {
        sendJson(response, 404, { message: `No ${role} found for this phone number` })
        return
      }

      otps.set(`${role}:${phone}`, OTP_CODE)
      sendJson(response, 200, { message: 'OTP sent successfully. Demo OTP is 123456.', otp: OTP_CODE })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/direct-login') {
      const payload = await readJson(request)
      const role = payload.role === 'receiver' ? 'receiver' : 'donor'
      const phone = normalizePhone(payload.phone)

      if (!/^\d{10}$/.test(phone)) {
        sendJson(response, 400, { message: 'Enter a valid registered 10-digit mobile number' })
        return
      }

      const user = findUser(role, phone)

      if (!user) {
        sendJson(response, 404, { message: `No registered ${role} found for this phone number` })
        return
      }

      sendJson(response, 200, { message: 'Login successful', user: publicUser(user) })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/auth/verify-otp') {
      const payload = await readJson(request)
      const role = payload.role === 'receiver' ? 'receiver' : 'donor'
      const phone = normalizePhone(payload.phone)
      const otpKey = `${role}:${phone}`

      if (otps.get(otpKey) !== String(payload.otp ?? '')) {
        sendJson(response, 401, { message: 'Invalid OTP' })
        return
      }

      const user = findUser(role, phone)

      if (!user) {
        sendJson(response, 404, { message: `No ${role} found for this phone number` })
        return
      }

      otps.delete(otpKey)
      sendJson(response, 200, { message: 'Login successful', user: publicUser(user) })
      return
    }

    sendJson(response, 404, { message: 'Route not found' })
  } catch (error) {
    sendJson(response, 500, { message: error instanceof Error ? error.message : 'Server error' })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`FoodBridge API running on http://${HOST}:${PORT}`)
})
