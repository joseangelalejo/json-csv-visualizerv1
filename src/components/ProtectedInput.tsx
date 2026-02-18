'use client'

import React, { useEffect, useRef } from 'react'

interface ProtectedInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  required?: boolean
  ariaDescribedBy?: string
  id?: string
  name?: string
  className?: string
  style?: React.CSSProperties
}

export default function ProtectedInput({ value, onChange, placeholder, type = 'text', required, ariaDescribedBy, id, name, className, style }: ProtectedInputProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // create shadow root once
    let shadow = (host as any).__shadowRoot as ShadowRoot | null
    if (!shadow) {
      shadow = host.attachShadow({ mode: 'open' })
        ; (host as any).__shadowRoot = shadow

      // container wrapper inside shadow so host can keep layout from page
      const wrapper = document.createElement('div')
      wrapper.setAttribute('part', 'wrapper')

      // create native input inside shadow
      const input = document.createElement('input')
      input.type = type
      input.value = value || ''
      if (id) input.id = id
      if (name) input.name = name
      if (placeholder) input.placeholder = placeholder
      if (required) input.required = true
      input.setAttribute('aria-describedby', ariaDescribedBy || '')
      // input fills the host element; host provides border/padding via className so input itself is visually transparent
      input.style.width = '100%'
      input.style.height = '100%'
      input.style.boxSizing = 'border-box'
      input.style.padding = '0'
      input.style.border = 'none'
      input.style.borderRadius = '0'
      input.style.fontFamily = 'inherit'
      input.style.fontSize = '1rem'
      input.style.background = 'transparent'
      input.style.color = '#0f172a' // protected color inside shadow DOM
      input.style.caretColor = '#0f172a'
      input.style.outline = 'none'

      // forward input events to React
      input.addEventListener('input', (ev) => {
        onChange((ev.target as HTMLInputElement).value)
      })

      // expose to refs
      inputRef.current = input

      // add a small style so focus has a visible ring inside shadow
      const styleEl = document.createElement('style')
      styleEl.textContent = `input:focus{ box-shadow: 0 0 0 4px rgba(99,102,241,0.12); border-color: #6366f1; }`

      wrapper.appendChild(styleEl)
      wrapper.appendChild(input)
      shadow.appendChild(wrapper)

      // focus host forwards to input
      host.addEventListener('click', () => input.focus())
    }

    // ensure inputRef updated values when props change
    const currentInput = inputRef.current
    if (currentInput) {
      if (currentInput.value !== value) currentInput.value = value || ''
      if (currentInput.type !== type) currentInput.type = type
      if (placeholder && currentInput.placeholder !== placeholder) currentInput.placeholder = placeholder
      if (required !== undefined) currentInput.required = required
    }
  }, [onChange, value, type, placeholder, required, id, name, ariaDescribedBy])

  // keep host classes so layout/styling from parent still applies
  // mark host so diagnostics / patches can find the shadow input
  return <div ref={hostRef} className={className} style={style} data-protected-input="true" role="group" tabIndex={0} />
}
