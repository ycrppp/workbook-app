'use client';

import { useState } from 'react';

const HINTS = ['Не помогло', 'Слабовато', 'Нормально', 'Полезно', 'Очень полезно'];

interface StarRatingProps {
  value: number;
  onChange: (n: number) => void;
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div>
      <div className="star-rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={`star ${i <= active ? 'active' : ''}`}
            onClick={() => onChange(i)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(0)}
          >
            ★
          </span>
        ))}
      </div>
      <div className="star-hint" style={{ marginBottom: '1.25rem' }}>
        {active ? HINTS[active - 1] : ''}
      </div>
    </div>
  );
}
