
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, setupScrollReveal, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedUser';

export default function Profile({
  role,
  onLogout
}) {
  const navigate = useNavigate();
  if (role === 'guest') return <div className="page" style={{
    textAlign: 'center'
  }}>
        <div className="profile-avatar" style={{
      opacity: 0.3
    }}>
          ?
        </div>
        <div className="page-title">Private Profile</div>
        <button className="btn btn-primary" style={{
      marginTop: 20
    }} onClick={() => navigate('/login')}>
          Sign in now
        </button>
      </div>;
  return <div className="page" style={{
    maxWidth: 520
  }}>
      <div className="page-title scroll-animate">My profile</div>
      <div className="page-sub scroll-animate">Manage your account details</div>
      <div className="card scroll-animate" style={{
      textAlign: 'center',
      marginBottom: 16,
      padding: '28px'
    }}>
        <div className="profile-avatar">MK</div>
        <div style={{
        fontSize: 16,
        fontWeight: 600,
        marginBottom: 4
      }}>
          Sereymongkol Thoeung
        </div>
        <div style={{
        fontSize: 13,
        color: 'var(--text-2)',
        marginBottom: 16
      }}>
          thoeungsereymongkol@gmail.com
        </div>
        <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 10
      }}>
          <span className="badge badge-green">Verified</span>
          <span className="badge badge-blue">Member since 2025</span>
        </div>
      </div>
      <div className="card scroll-animate" style={{
      marginBottom: 16
    }}>
        <div className="sec-title">Personal information</div>
        <div className="form-row">
          <div>
            <div className="label">First name</div>
            <input defaultValue="Sereymongkol" />
          </div>
          <div>
            <div className="label">Last name</div>
            <input defaultValue="Thoeung" />
          </div>
        </div>
        <div className="form-group">
          <div className="label">Email</div>
          <input defaultValue="thoeungsereymongkol@gmail.com" />
        </div>
        <div className="form-group">
          <div className="label">Phone</div>
          <input defaultValue="+855 17 420 051" />
        </div>
        <div className="form-group">
          <div className="label">National ID</div>
          <input defaultValue="ID123456789" />
        </div>
        <button className="btn btn-primary btn-sm">
          <Icon d={icons.edit} size={13} color="#fff" /> Save changes
        </button>
      </div>
      <div className="card scroll-animate" style={{
      marginBottom: 16
    }}>
        <div className="sec-title">Change password</div>
        <div className="form-group">
          <div className="label">Current password</div>
          <input type="password" placeholder="••••••••" />
        </div>
        <div className="form-group">
          <div className="label">New password</div>
          <input type="password" placeholder="••••••••" />
        </div>
        <div className="form-group">
          <div className="label">Confirm new password</div>
          <input type="password" placeholder="••••••••" />
        </div>
        <button className="btn btn-ghost btn-sm">Update password</button>
      </div>
      <div className="card scroll-animate">
        <div className="sec-title" style={{
        marginBottom: 8
      }}>
          Trip stats
        </div>
        {[{
        k: 'Total trips',
        v: '12'
      }, {
        k: 'Total rentals',
        v: '3'
      }, {
        k: 'Favourite route',
        v: 'PP → SR'
      }].map(s => <div key={s.k} style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '9px 0',
        borderBottom: '0.5px solid rgba(255,255,255,0.05)'
      }}>
            <span style={{
          fontSize: 13,
          color: 'var(--text-2)'
        }}>{s.k}</span>
            <span style={{
          fontSize: 13,
          fontWeight: 500
        }}>{s.v}</span>
          </div>)}
        <div style={{
        marginTop: 16
      }}>
          <button className="btn btn-red btn-sm" onClick={onLogout}>
            <Icon d={icons.logout} size={12} /> Sign out
          </button>
        </div>
      </div>
    </div>;
}
