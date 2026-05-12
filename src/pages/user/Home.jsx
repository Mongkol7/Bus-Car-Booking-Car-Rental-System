
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { carModels } from '../../data/transportData';
import Footer from '../../components/Footer';
import { Icon, icons, setupScrollReveal, NAV, companyMeta, getCompanyMeta } from '../../utils/sharedUser';

export default function Home({
  role,
  setActive
}) {
  return <div>
      <div className="hero">
        <div className="page hero-content">
          <div className="hero-title">
            Travel smarter
            <br />
            across <span>Cambodia</span>
          </div>
          <div className="hero-sub">
            Book bus seats or rent a car — fast, simple, and on the go.
          </div>

          {/* ── EARTH SURFACE + CAR ── */}
          <div className="earth-wrap" style={{
          marginTop: 36
        }}>
            {/* Earth curve + glow */}
            <svg viewBox="0 0 1440 140" preserveAspectRatio="none" style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%'
          }} xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="earthGlow" cx="50%" cy="0%" r="70%">
                  <stop offset="0%" stopColor="rgba(79,142,247,0.22)" />
                  <stop offset="55%" stopColor="rgba(79,142,247,0.08)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <filter id="lineGlow" x="-20%" y="-100%" width="140%" height="300%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {/* Earth fill */}
              <path d="M0,140 Q720,-60 1440,140 Z" fill="url(#earthGlow)" />
              {/* Soft glow line */}
              <path d="M0,140 Q720,-60 1440,140" fill="none" stroke="rgba(79,142,247,0.3)" strokeWidth="2" filter="url(#lineGlow)" />
              {/* Sharp line */}
              <path d="M0,140 Q720,-60 1440,140" fill="none" stroke="rgba(79,142,247,0.65)" strokeWidth="1" />
            </svg>

            {/* Car on the arc */}
            <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}>
              <svg viewBox="0 0 1440 140" preserveAspectRatio="none" style={{
              width: '100%',
              height: '100%'
            }} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <path id="carPath" d="M0,140 Q720,-60 1440,140" />
                </defs>
                {/* Headlight glow is now inside the car <g> below — removed standalone element */}
                {/* Car */}
                <g>
                  <animateMotion dur="10s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#carPath" />
                  </animateMotion>
                  {/* Headlight glow — offset forward (cx=18) so it stays in front of the car */}
                  <ellipse cx="18" cy="-3" rx="28" ry="7" fill="rgba(255,230,100,0.13)" />
                  <ellipse cx="0" cy="10" rx="18" ry="3" fill="rgba(0,0,0,0.25)" />
                  <rect x="-14" y="-8" width="28" height="10" rx="3" fill="#1e3a5f" stroke="rgba(79,142,247,0.6)" strokeWidth="0.8" />
                  <rect x="-8" y="-15" width="16" height="8" rx="2" fill="#152d4a" stroke="rgba(79,142,247,0.4)" strokeWidth="0.6" />
                  <rect x="-6" y="-14" width="6" height="6" rx="1" fill="rgba(120,180,255,0.5)" />
                  <rect x="2" y="-14" width="5" height="6" rx="1" fill="rgba(120,180,255,0.3)" />
                  <rect x="13" y="-5" width="3" height="2" rx="0.5" fill="rgba(255,230,100,0.95)" />
                  <rect x="-16" y="-5" width="3" height="2" rx="0.5" fill="rgba(255,80,80,0.8)" />
                  <circle cx="-8" cy="3" r="4" fill="#0a0a0f" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                  <circle cx="-8" cy="3" r="2" fill="#1a1a2e" />
                  <circle cx="8" cy="3" r="4" fill="#0a0a0f" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
                  <circle cx="8" cy="3" r="2" fill="#1a1a2e" />
                  <rect x="-14" y="-3" width="28" height="1" rx="0.5" fill="rgba(79,142,247,0.5)" />
                </g>
              </svg>
            </div>
          </div>

          <div className="service-grid">
            <div className="service-card" onClick={() => setActive('search')}>
              <div className="hero-emoji">🚌</div>
              <div style={{
              fontWeight: 600,
              marginBottom: 4
            }}>
                Bus seat booking
              </div>
              <div style={{
              fontSize: 12,
              color: 'var(--text-2)'
            }}>
                Search routes, pick seats and pay.
              </div>
              <button className="btn btn-primary btn-sm" style={{
              marginTop: 16
            }}>
                Book now
              </button>
            </div>
            <div className="service-card" onClick={() => setActive('cars')}>
              <div className="hero-emoji">🚗</div>
              <div style={{
              fontWeight: 600,
              marginBottom: 4
            }}>Car rental</div>
              <div style={{
              fontSize: 12,
              color: 'var(--text-2)'
            }}>
                Browse sedans and SUVs for rent.
              </div>
              <button className="btn btn-primary btn-sm" style={{
              marginTop: 16
            }}>
                Browse cars
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page">
        <div className="sec-title">Recent activity</div>
        {role === 'guest' ? <div className="card scroll-animate" style={{
        textAlign: 'center',
        padding: '32px'
      }}>
            <p style={{
          color: 'var(--text-3)',
          fontSize: '13px'
        }}>
              No recent activity. Sign in to track your trips.
            </p>
          </div> : [{
        type: 'ticket',
        route: 'Phnom Penh → Siem Reap',
        company: 'Mekong Express',
        date: 'Apr 5, 06:00',
        seat: 'A12',
        status: 'Confirmed'
      }, {
        type: 'rental',
        route: 'Toyota Camry rental',
        date: 'Mar 28 – Apr 3',
        seat: '3 days',
        status: 'Returned'
      }].map((b, i) => <div key={i} className="booking-item ticket-card scroll-animate" style={{
        '--delay': `${i * 40}ms`
      }}>
              <div className="booking-header">
                <div>
                  <span className={`badge ${b.type === 'ticket' ? 'badge-blue' : 'badge-purple'}`} style={{
              marginBottom: 6,
              fontSize: 9
            }}>
                    {b.type === 'ticket' ? 'BUS TICKET' : 'CAR RENTAL'}
                  </span>
                  <div className="booking-route">{b.route}</div>
                  {b.type === 'ticket' && <div style={{
              fontSize: 11,
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2
            }}>
                      <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: getCompanyMeta(b.company).color
              }} />
                      <span style={{
                color: getCompanyMeta(b.company).color
              }}>
                        {b.company}
                      </span>
                    </div>}
                </div>
                <span className={`badge ${b.status === 'Confirmed' ? 'badge-green' : 'badge-purple'}`}>
                  {b.status}
                </span>
              </div>
              <div className="booking-meta">
                <div className="booking-meta-item">
                  Date<span>{b.date}</span>
                </div>
                <div className="booking-meta-item">
                  {b.type === 'ticket' ? 'Seat' : 'Duration'}
                  <span>{b.seat}</span>
                </div>
                {b.type === 'ticket' && <div className="booking-meta-item">
                    Bus
                    <span style={{
              color: getCompanyMeta(b.company).color
            }}>
                      {b.company}
                    </span>
                  </div>}
              </div>
            </div>)}
      </div>
    </div>;
}
