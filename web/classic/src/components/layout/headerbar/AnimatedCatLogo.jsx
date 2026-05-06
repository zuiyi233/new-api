/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';

const AnimatedCatLogo = () => {
  return (
    <svg
      viewBox='0 0 64 64'
      role='img'
      aria-label='动态小猫 Logo'
      className='h-full w-full'
    >
      <defs>
        <radialGradient id='cat-logo-bg' cx='30%' cy='25%' r='75%'>
          <stop offset='0%' stopColor='#2563eb' />
          <stop offset='100%' stopColor='#020617' />
        </radialGradient>
        <linearGradient id='cat-logo-face' x1='0%' y1='0%' x2='100%' y2='100%'>
          <stop offset='0%' stopColor='#fefce8' />
          <stop offset='100%' stopColor='#fde68a' />
        </linearGradient>
      </defs>

      <circle cx='32' cy='32' r='31' fill='url(#cat-logo-bg)' />

      <g>
        <animateTransform
          attributeName='transform'
          type='translate'
          values='0 0;0 -0.9;0 0'
          dur='2.8s'
          repeatCount='indefinite'
        />

        <path
          d='M42 40c8 1 11-8 5-13'
          fill='none'
          stroke='#fef3c7'
          strokeWidth='3'
          strokeLinecap='round'
        >
          <animateTransform
            attributeName='transform'
            type='rotate'
            values='-8 42 40;10 42 40;-8 42 40'
            dur='2s'
            repeatCount='indefinite'
          />
        </path>

        <path d='M21 24l6-11 4 11z' fill='url(#cat-logo-face)' />
        <path d='M43 24l-6-11-4 11z' fill='url(#cat-logo-face)' />
        <path d='M23 22l4-7 2.2 6z' fill='#fb7185' />
        <path d='M41 22l-4-7-2.2 6z' fill='#fb7185' />

        <circle cx='32' cy='33' r='14' fill='url(#cat-logo-face)' />

        <ellipse cx='27' cy='32' rx='2.3' ry='3' fill='#111827'>
          <animate
            attributeName='ry'
            values='3;3;0.4;3;3'
            dur='4s'
            repeatCount='indefinite'
          />
        </ellipse>
        <ellipse cx='37' cy='32' rx='2.3' ry='3' fill='#111827'>
          <animate
            attributeName='ry'
            values='3;3;0.4;3;3'
            dur='4s'
            begin='0.18s'
            repeatCount='indefinite'
          />
        </ellipse>

        <path d='M32 34.5l2.4 2.4h-4.8z' fill='#f43f5e' />
        <path
          d='M31 37c0 1.5-1.2 2.5-2.6 2.5M33 37c0 1.5 1.2 2.5 2.6 2.5'
          fill='none'
          stroke='#7c2d12'
          strokeLinecap='round'
          strokeWidth='1.5'
        />

        <path
          d='M22 35h-7m7 2h-7m20-2h7m-7 2h7'
          stroke='#fef3c7'
          strokeLinecap='round'
          strokeWidth='1.5'
        />
      </g>
    </svg>
  );
};

export default AnimatedCatLogo;
