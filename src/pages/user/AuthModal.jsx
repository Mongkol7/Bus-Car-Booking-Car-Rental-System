
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, setupScrollReveal, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedUser';

export default function AuthModal({
  onConfirm,
  onClose
}) {
  return <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="modal-icon">🔐</div>
        <div className="modal-title">Sign in required</div>
        <div className="modal-text">
          To continue with your booking or rental, please sign in to your
          account. It's fast and secure.
        </div>
        <div className="modal-btns">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Sign in now
          </button>
        </div>
      </div>
    </div>;
}
