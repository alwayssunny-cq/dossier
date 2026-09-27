interface Props {
  variant?: 'dark' | 'white' | 'muted'
  height?: number
}

export default function CQLogo({ variant = 'dark', height = 48 }: Props) {
  const style: React.CSSProperties = {
    height,
    width: 'auto',
    display: 'block',
    userSelect: 'none',
  }

  if (variant === 'white') {
    // invert black→white for use on dark backgrounds
    style.filter = 'brightness(0) invert(1)'
  } else if (variant === 'muted') {
    // blend away white bg, reduce to muted Borges tone
    style.mixBlendMode = 'multiply'
    style.opacity = 0.45
  } else {
    // dark: blend away white bg on light var(--color-surface) surface
    style.mixBlendMode = 'multiply'
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/Logo.png" alt="Closequarters Club" style={style} draggable={false} />
}
