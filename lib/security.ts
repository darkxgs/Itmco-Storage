import { NextRequest } from "next/server"
import { supabase } from "./supabase"

// SQL Injection protection patterns
const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
  /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
  /('|(\\')|(;)|(--)|(\s*(or|and)\s*\w+\s*=\s*\w+))/gi,
  /(\/\*[\s\S]*?\*\/)/gi,
  /(\bxp_\w+)/gi,
  /(\bsp_\w+)/gi,
  /(\b(waitfor|delay)\s+time\b)/gi,
  /(\bunion\s+(all\s+)?select)/gi,
  /(\bdeclare\s+@\w+)/gi,
  /(\bcast\s*\()/gi,
  /(\bconvert\s*\()/gi,
  /(\bchar\s*\()/gi,
  /(\bnchar\s*\()/gi,
  /(\bascii\s*\()/gi,
  /(\bsubstring\s*\()/gi,
  /(\blen\s*\()/gi,
  /(\blower\s*\()/gi,
  /(\bupper\s*\()/gi,
]

// XSS protection patterns
const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  /<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi,
  /<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi,
  /javascript:/gi,
  /vbscript:/gi,
  /onload\s*=/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /onmouseover\s*=/gi,
  /onfocus\s*=/gi,
  /onblur\s*=/gi,
  /onchange\s*=/gi,
  /onsubmit\s*=/gi,
]

// Rate limiting storage (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export interface SecurityConfig {
  enableSqlInjectionProtection: boolean
  enableXssProtection: boolean
  enableRateLimit: boolean
  rateLimitRequests: number
  rateLimitWindow: number // in milliseconds
  enableInputSanitization: boolean
  maxInputLength: number
}

const defaultSecurityConfig: SecurityConfig = {
  enableSqlInjectionProtection: true,
  enableXssProtection: true,
  enableRateLimit: true,
  rateLimitRequests: 100, // 100 requests per window
  rateLimitWindow: 15 * 60 * 1000, // 15 minutes
  enableInputSanitization: true,
  maxInputLength: 10000,
}

export class SecurityError extends Error {
  constructor(
    message: string,
    public type: 'SQL_INJECTION' | 'XSS' | 'RATE_LIMIT' | 'INPUT_TOO_LONG' | 'INVALID_INPUT',
    public details?: any
  ) {
    super(message)
    this.name = 'SecurityError'
  }
}

export function detectSqlInjection(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input))
}

export function detectXss(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  
  return XSS_PATTERNS.some(pattern => pattern.test(input))
}

export function sanitizeInput(input: string): string {
  if (!input || typeof input !== 'string') return input
  
  // Remove potential XSS
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/vbscript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
  
  // Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
  
  return sanitized.trim()
}

export function validateInput(input: any, config: SecurityConfig = defaultSecurityConfig): string {
  if (input === null || input === undefined) {
    return ''
  }
  
  const stringInput = String(input)
  
  // Check input length
  if (config.maxInputLength && stringInput.length > config.maxInputLength) {
    throw new SecurityError(
      `Input too long. Maximum ${config.maxInputLength} characters allowed.`,
      'INPUT_TOO_LONG',
      { length: stringInput.length, maxLength: config.maxInputLength }
    )
  }
  
  // Check for SQL injection
  if (config.enableSqlInjectionProtection && detectSqlInjection(stringInput)) {
    throw new SecurityError(
      'Potential SQL injection detected',
      'SQL_INJECTION',
      { input: stringInput.substring(0, 100) }
    )
  }
  
  // Check for XSS
  if (config.enableXssProtection && detectXss(stringInput)) {
    throw new SecurityError(
      'Potential XSS attack detected',
      'XSS',
      { input: stringInput.substring(0, 100) }
    )
  }
  
  // Sanitize input if enabled
  if (config.enableInputSanitization) {
    return sanitizeInput(stringInput)
  }
  
  return stringInput
}

export function validateObject(obj: any, config: SecurityConfig = defaultSecurityConfig): any {
  if (!obj || typeof obj !== 'object') {
    return validateInput(obj, config)
  }
  
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const sanitizedKey = validateInput(key, config)
    
    if (Array.isArray(value)) {
      sanitized[sanitizedKey] = value.map(item => validateObject(item, config))
    } else if (typeof value === 'object' && value !== null) {
      sanitized[sanitizedKey] = validateObject(value, config)
    } else {
      sanitized[sanitizedKey] = validateInput(value, config)
    }
  }
  
  return sanitized
}

export function checkRateLimit(
  identifier: string,
  config: SecurityConfig = defaultSecurityConfig
): boolean {
  if (!config.enableRateLimit) return true
  
  const now = Date.now()
  const key = `rate_limit_${identifier}`
  const existing = rateLimitStore.get(key)
  
  if (!existing || now > existing.resetTime) {
    // Reset or create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + config.rateLimitWindow
    })
    return true
  }
  
  if (existing.count >= config.rateLimitRequests) {
    return false
  }
  
  existing.count++
  return true
}

export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  
  const ip = forwarded?.split(',')[0] || realIp || cfConnectingIp || 'unknown'
  
  // Include user agent for additional uniqueness
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  return `${ip}_${Buffer.from(userAgent).toString('base64').substring(0, 10)}`
}

export async function logSecurityEvent(
  type: string,
  details: any,
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM'
) {
  try {
    await supabase.from('security_logs').insert({
      event_type: type,
      severity,
      details: JSON.stringify(details),
      timestamp: new Date().toISOString(),
      ip_address: details.ip || 'unknown',
      user_agent: details.userAgent || 'unknown'
    })
  } catch (error) {
    console.error('Failed to log security event:', error)
  }
}

export function createSecurityMiddleware(config: SecurityConfig = defaultSecurityConfig) {
  return async (request: NextRequest) => {
    const identifier = getClientIdentifier(request)
    
    // Rate limiting
    if (!checkRateLimit(identifier, config)) {
      await logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        ip: identifier,
        userAgent: request.headers.get('user-agent'),
        url: request.url,
        method: request.method
      }, 'HIGH')
      
      throw new SecurityError(
        'Rate limit exceeded. Please try again later.',
        'RATE_LIMIT'
      )
    }
    
    // Validate request body if present
    if (request.method !== 'GET' && request.headers.get('content-type')?.includes('application/json')) {
      try {
        const body = await request.json()
        const sanitizedBody = validateObject(body, config)
        
        // Replace the original request with sanitized data
        return new Request(request.url, {
          method: request.method,
          headers: request.headers,
          body: JSON.stringify(sanitizedBody)
        })
      } catch (error) {
        if (error instanceof SecurityError) {
          await logSecurityEvent('SECURITY_VIOLATION', {
            type: error.type,
            message: error.message,
            details: error.details,
            ip: identifier,
            userAgent: request.headers.get('user-agent'),
            url: request.url,
            method: request.method
          }, 'CRITICAL')
          
          throw error
        }
      }
    }
    
    return request
  }
}

// Utility function to create secure database queries
export function createSecureQuery(tableName: string, operation: 'select' | 'insert' | 'update' | 'delete') {
  // Whitelist allowed table names
  const allowedTables = ['users', 'products', 'issuances', 'activity_logs']
  
  if (!allowedTables.includes(tableName)) {
    throw new SecurityError(
      `Table '${tableName}' is not allowed`,
      'INVALID_INPUT',
      { tableName }
    )
  }
  
  return supabase.from(tableName)
}

// Password security utilities
export function validatePasswordStrength(password: string): {
  isValid: boolean
  errors: string[]
  score: number
} {
  const errors: string[] = []
  let score = 0
  
  if (password.length < 8) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
  } else {
    score += 1
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل')
  } else {
    score += 1
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل')
  } else {
    score += 1
  }
  
  if (!/\d/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على رقم واحد على الأقل')
  } else {
    score += 1
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل')
  } else {
    score += 1
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    score
  }
}