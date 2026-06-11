import { useState } from 'react';
import { useBalance, formatStars } from '../utils/balance';
import { hapticSelection } from '../utils/haptics';
import StarIcon from './StarIcon';
import StarsModal from './StarsModal';
import './StarBalanceButton.css';

export default function StarBalanceButton() {
  const { balance } = useBalance();
  const [open, setOpen] = useState(false);

  const handleClick = () => { hapticSelection(); setOpen(true); };

  return (
    <>
      <button className="stars-btn" onClick={handleClick} aria-label="Баланс звёзд">
        <StarIcon size={16} />
        <span className="stars-btn__amount">{formatStars(balance?.balance ?? 0)}</span>
        <span className="stars-btn__plus" aria-hidden>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1.5v9M1.5 6h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && <StarsModal onClose={() => setOpen(false)} />}
    </>
  );
}
