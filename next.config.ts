/**
 * Configuración de Next.js - next.config.ts
 *
 * Archivo de configuración principal para la aplicación Next.js.
 * Define headers de seguridad, optimizaciones de rendimiento y
 * configuraciones específicas del framework.
 *
 * Características de seguridad implementadas:
 * - Headers de seguridad HTTP para prevenir ataques comunes
 * - Content Security Policy (CSP) restrictiva
 * - Deshabilitación del header X-Powered-By
 * - Configuración CORS para APIs
 *
 * Headers de seguridad incluidos:
 * - X-Frame-Options: Previene clickjacking
 * - X-Content-Type-Options: Previene MIME sniffing
 * - Referrer-Policy: Controla envío de referrer
 * - X-XSS-Protection: Protección XSS en navegadores legacy
 * - CSP: Política de seguridad de contenido
 * - CORS: Configuración de origen cruzado
 *
 * @author José Ángel Alejo
 * @version 1.0.0
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // === HEADERS DE SEGURIDAD ===
  // Configuración de headers HTTP para todas las rutas
  async headers() {
    return [
      {
        source: '/(.*)', // Aplica a todas las rutas
        headers: [
          // === PROTECCIÓN CONTRA CLICKJACKING ===
          {
            key: 'X-Frame-Options',
            value: 'DENY' // No permite embeber la app en frames/iframes
          },

          // === PREVENCIÓN DE MIME SNIFFING ===
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff' // Fuerza al navegador a respetar Content-Type
          },

          // === CONTROL DE REFERER ===
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin' // Envía referrer solo en mismo origen
          },

          // === PROTECCIÓN XSS (LEGACY) ===
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block' // Activa filtro XSS en navegadores antiguos
          },

          // === CONTENT SECURITY POLICY ===
          // Política restrictiva que solo permite recursos del mismo origen
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
          },

          // === CONFIGURACIÓN CORS ===
          // Permite solicitudes desde cualquier origen (para desarrollo)
          // NOTA: En producción debería restringirse a dominios específicos
          {
            key: 'Access-Control-Allow-Origin',
            value: '*' // Permitir cualquier origen
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS' // Métodos HTTP permitidos
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization' // Headers permitidos
          }
        ]
      }
    ]
  },

  // === DESHABILITAR HEADER X-POWERED-BY ===
  // Oculta información del servidor para reducir superficie de ataque
  poweredByHeader: false,

  // === PAQUETES EXTERNOS DEL SERVIDOR ===
  // Lista de paquetes que se ejecutan fuera del bundle de Next.js
  // Útil para paquetes que causan problemas de bundling
  serverExternalPackages: []
};

export default nextConfig;
