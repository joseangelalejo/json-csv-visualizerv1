'use client'

/**
 * ProtectedSelect — dropdown 100% custom (sin <select> nativo).
 *
 * POR QUÉ:
 *   El <select> nativo es pintado parcialmente por el SO/navegador y extensiones
 *   como Dark Reader inyectan estilos con altísima prioridad que hacen invisible
 *   el texto del valor cerrado. Shadow DOM tampoco lo resuelve completamente porque
 *   las CSS vars del documento padre no penetran el shadow root, y el UA stylesheet
 *   del <select> puede seguir ganando.
 *
 *   Al reemplazarlo por un div+ul controlado por React tenemos control total del
 *   color, fondo y layout — nada externo puede sobreescribirlo porque usamos
 *   inline styles con valores literales (sin vars CSS).
 */

import React, { useState, useRef, useEffect, useCallback, useId } from 'react'

interface OptionItem {
    value: string
    label: string
    disabled?: boolean
}

interface ProtectedSelectProps {
    value: string | number
    onChange: (value: string) => void
    options: OptionItem[]
    className?: string
    style?: React.CSSProperties
    id?: string
    name?: string
    disabled?: boolean
    ariaDescribedBy?: string
}

export default function ProtectedSelect({
    value,
    onChange,
    options,
    className = '',
    style,
    id,
    name,
    disabled = false,
    ariaDescribedBy,
}: ProtectedSelectProps) {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const listboxId = useId()

    const selectedLabel =
        options.find((o) => String(o.value) === String(value))?.label ?? String(value)

    useEffect(() => {
        if (!open) return
        const handleOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        document.addEventListener('mousedown', handleOutside)
        return () => document.removeEventListener('mousedown', handleOutside)
    }, [open])

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            if (disabled) return
            const currentIndex = options.findIndex((o) => String(o.value) === String(value))
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setOpen((v) => !v)
            } else if (e.key === 'Escape') {
                setOpen(false)
            } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                const next = options.slice(currentIndex + 1).find((o) => !o.disabled)
                if (next) onChange(next.value)
                setOpen(true)
            } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                const prev = [...options].slice(0, currentIndex).reverse().find((o) => !o.disabled)
                if (prev) onChange(prev.value)
                setOpen(true)
            }
        },
        [disabled, options, value, onChange]
    )

    const handleSelect = (optValue: string) => {
        onChange(optValue)
        setOpen(false)
    }

    const TEXT_COLOR = '#111827'
    const BG_COLOR = '#ffffff'
    const BORDER_COLOR = '#d1d5db'
    const HOVER_BG = '#f3f4f6'
    const SELECTED_BG = '#ede9fe'
    const SELECTED_TEXT = '#6d28d9'
    const DISABLED_TEXT = '#9ca3af'

    return (
        <div
            ref={containerRef}
            className={className}
            style={{ position: 'relative', userSelect: 'none', ...style }}
            data-protected-select="true"
        >
            {name && (
                <input type="hidden" name={name} id={id} value={String(value)} readOnly />
            )}

            <div
                role="combobox"
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-controls={listboxId}
                aria-describedby={ariaDescribedBy}
                tabIndex={disabled ? -1 : 0}
                onKeyDown={handleKeyDown}
                onClick={() => !disabled && setOpen((v) => !v)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '0.65rem 0.75rem',
                    backgroundColor: disabled ? '#f9fafb' : BG_COLOR,
                    color: disabled ? DISABLED_TEXT : TEXT_COLOR,
                    border: `1px solid ${BORDER_COLOR}`,
                    borderRadius: '0.75rem',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    outline: 'none',
                }}
            >
                <span
                    style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: disabled ? DISABLED_TEXT : TEXT_COLOR,
                        WebkitTextFillColor: disabled ? DISABLED_TEXT : TEXT_COLOR,
                    }}
                >
                    {selectedLabel || <span style={{ color: DISABLED_TEXT }}>Selecciona...</span>}
                </span>

                <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    style={{
                        width: '1.1rem',
                        height: '1.1rem',
                        flexShrink: 0,
                        marginLeft: '0.5rem',
                        color: TEXT_COLOR,
                        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                    }}
                >
                    <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                    />
                </svg>
            </div>

            {open && !disabled && (
                <ul
                    id={listboxId}
                    role="listbox"
                    style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        left: 0,
                        right: 0,
                        zIndex: 9999,
                        backgroundColor: BG_COLOR,
                        border: `1px solid ${BORDER_COLOR}`,
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
                        maxHeight: '14rem',
                        overflowY: 'auto',
                        margin: 0,
                        padding: '0.25rem',
                        listStyle: 'none',
                    }}
                >
                    {options.map((opt) => {
                        const isSelected = String(opt.value) === String(value)
                        const isDisabled = !!opt.disabled
                        return (
                            <li
                                key={opt.value}
                                role="option"
                                aria-selected={isSelected}
                                aria-disabled={isDisabled}
                                onClick={() => !isDisabled && handleSelect(opt.value)}
                                style={{
                                    padding: '0.55rem 0.75rem',
                                    borderRadius: '0.5rem',
                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                    backgroundColor: isSelected ? SELECTED_BG : 'transparent',
                                    color: isDisabled ? DISABLED_TEXT : isSelected ? SELECTED_TEXT : TEXT_COLOR,
                                    WebkitTextFillColor: isDisabled ? DISABLED_TEXT : isSelected ? SELECTED_TEXT : TEXT_COLOR,
                                    fontWeight: isSelected ? 600 : 400,
                                    fontSize: '0.95rem',
                                    fontFamily: 'inherit',
                                    transition: 'background-color 0.1s ease',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isDisabled && !isSelected)
                                        (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG
                                }}
                                onMouseLeave={(e) => {
                                    if (!isDisabled && !isSelected)
                                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                                }}
                            >
                                {opt.label}
                            </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
