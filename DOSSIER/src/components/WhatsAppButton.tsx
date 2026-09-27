'use client'

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/919884256431"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'scale(1.08)'
        el.style.boxShadow = '0 6px 20px rgb(var(--night-rgb) / 0.3)'
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'scale(1)'
        el.style.boxShadow = '0 4px 16px rgb(var(--night-rgb) / 0.2)'
      }}
      style={{
        // Position belongs to the dock in the trip layout. This button used to
        // be fixed at bottom:100px to sit above the currency converter — but
        // the converter is hidden during Crafting and Reservations, leaving
        // the button floating above a gap on exactly those stages.
        width: '44px',
        flexShrink: 0,
        height: '44px',
        borderRadius: '50%',
        backgroundColor: 'var(--color-text)',
        border: '0.5px solid rgb(var(--mist-rgb) / 0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 16px rgb(var(--night-rgb) / 0.2)',
        textDecoration: 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M16 3C9.373 3 4 8.373 4 15c0 2.385.668 4.61 1.822 6.505L4 29l7.697-1.807A11.94 11.94 0 0016 27c6.627 0 12-5.373 12-12S22.627 3 16 3z"
          fill="#FFFCF8"
        />
        <path
          d="M21.5 18.5c-.3-.15-1.767-.871-2.04-.97-.273-.099-.471-.148-.669.15-.198.297-.767.97-.94 1.169-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.457.13-.605.133-.133.297-.347.446-.52.148-.174.198-.298.297-.496.099-.198.05-.372-.025-.52-.074-.148-.669-1.612-.916-2.207-.241-.58-.486-.5-.669-.51-.173-.01-.372-.012-.57-.012-.198 0-.52.074-.793.372-.272.297-1.04 1.016-1.04 2.479s1.065 2.876 1.213 3.074c.148.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.626.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.29.173-1.413-.074-.124-.272-.198-.57-.347z"
          fill="#08070E"
        />
      </svg>
    </a>
  )
}
