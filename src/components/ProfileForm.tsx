'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar } from './Avatar';
import { calculateAge } from '@/lib/profile-validation';

interface ProfileFormProps {
  initialData?: {
    firstName?: string;
    dateOfBirth?: string;
    gender?: 'Man' | 'Woman' | string;
    avatarType?: 'Man' | 'Woman';
    interestedIn?: 'Men' | 'Women' | 'Everyone';
    bio?: string;
    interests?: string[];
  };
  isEditMode?: boolean;
}

const COMMON_INTERESTS = [
  'Coffee', 'Books', 'Music', 'Cinema', 'Hiking', 
  'Cooking', 'Travel', 'Art', 'Design', 'Running', 
  'Photography', 'Tech', 'Cycling', 'Gaming', 'Writing'
];

export function ProfileForm({ initialData, isEditMode = false }: ProfileFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(initialData?.firstName || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    initialData?.dateOfBirth ? initialData.dateOfBirth.substring(0, 10) : ''
  );
  const [gender, setGender] = useState<'Man' | 'Woman' | string>(initialData?.gender || 'Man');
  const [avatarType, setAvatarType] = useState<'Man' | 'Woman' | 'Other'>(initialData?.avatarType || 'Man');
  const [interestedIn, setInterestedIn] = useState<'Men' | 'Women' | 'Everyone'>(
    initialData?.interestedIn || 'Everyone'
  );
  const [bio, setBio] = useState(initialData?.bio || '');
  const [interests, setInterests] = useState<string[]>(initialData?.interests || []);
  const [customInterest, setCustomInterest] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const calculatedAge = dateOfBirth ? calculateAge(dateOfBirth) : null;
  const isUnderAge = calculatedAge !== null && calculatedAge < 18;

  // Auto-sync avatarType when gender changes
  const handleGenderChange = (selected: string) => {
    setGender(selected);
    if (selected === 'Man' || selected === 'Woman') {
      setAvatarType(selected);
    } else if (selected === 'Other') {
      setAvatarType('Other');
    }
  };

  const toggleInterest = (interest: string) => {
    if (interests.includes(interest)) {
      setInterests(interests.filter((i) => i !== interest));
    } else {
      if (interests.length >= 5) {
        setError('You can select a maximum of 5 interests.');
        return;
      }
      setError(null);
      setInterests([...interests, interest]);
    }
  };

  const handleAddCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customInterest.trim();
    if (!trimmed) return;
    if (interests.includes(trimmed)) {
      setCustomInterest('');
      return;
    }
    if (interests.length >= 5) {
      setError('You can select a maximum of 5 interests.');
      return;
    }
    setInterests([...interests, trimmed]);
    setCustomInterest('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (isUnderAge) {
      setError('You must be at least 18 years old to use Speedating.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          dateOfBirth,
          gender,
          avatarType,
          interestedIn,
          bio,
          interests,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save profile');
      }

      setSuccess('Profile saved successfully.');

      if (!isEditMode) {
        // Return to home page where video button awaits
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 600);
      } else {
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An error occurred while saving profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--surface-soft)',
            border: '1px solid var(--border-strong)',
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--surface-primary)',
            border: '1px solid var(--border-strong)',
            fontSize: '14px',
            color: 'var(--text-primary)',
          }}
        >
          {success}
        </div>
      )}

      {/* First Name */}
      <div>
        <label
          htmlFor="firstName"
          className="type-controls"
          style={{ display: 'block', marginBottom: '6px' }}
        >
          First name <span style={{ color: 'var(--text-muted)' }}>*</span>
        </label>
        <input
          id="firstName"
          type="text"
          required
          maxLength={64}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Alex"
          className="form-input"
        />
      </div>

      {/* Date of Birth */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label htmlFor="dateOfBirth" className="type-controls">
            Date of birth <span style={{ color: 'var(--text-muted)' }}>*</span>
          </label>
          <span className="type-meta">
            {calculatedAge !== null && (
              <span>
                Age: {calculatedAge}{' '}
                {isUnderAge && <strong style={{ color: 'var(--action-destructive)' }}>(Must be 18+)</strong>}
              </span>
            )}
          </span>
        </div>
        <input
          id="dateOfBirth"
          type="date"
          required
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className="form-input"
          max={new Date().toISOString().split('T')[0]}
        />
        <p className="type-meta" style={{ marginTop: '4px' }}>
          Used strictly for age verification. You must be 18 or older.
        </p>
      </div>

      {/* Gender Presentation */}
      <div>
        <label className="type-controls" style={{ display: 'block', marginBottom: '8px' }}>
          Gender <span style={{ color: 'var(--text-muted)' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {(['Man', 'Woman', 'Other'] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => handleGenderChange(g)}
              className="btn"
              style={{
                backgroundColor: gender === g ? 'var(--action-primary)' : 'var(--surface-primary)',
                color: gender === g ? 'var(--action-primary-text)' : 'var(--text-primary)',
                borderColor: gender === g ? 'var(--action-primary)' : 'var(--border-subtle)',
              }}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* Generated Avatar Selection - disappears when gender is Other */}
      {gender !== 'Other' && (
        <div>
          <label className="type-controls" style={{ display: 'block', marginBottom: '8px' }}>
            Generated Avatar <span style={{ color: 'var(--text-muted)' }}>*</span>
          </label>
          <p className="type-meta" style={{ marginBottom: '12px' }}>
            Speedating does not use profile photos. Choose your minimalist avatar marker.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {(['Man', 'Woman'] as const).map((type) => {
              const isSelected = avatarType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAvatarType(type)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '12px 16px',
                    border: isSelected ? '2px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: isSelected ? 'var(--surface-soft)' : 'var(--surface-primary)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'border var(--transition-fast), background-color var(--transition-fast)',
                  }}
                >
                  <Avatar type={type} size={44} />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{type} Avatar</div>
                    <div className="type-meta" style={{ fontSize: '11px' }}>
                      {isSelected ? 'Selected' : 'Click to select'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dating Preference */}
      <div>
        <label className="type-controls" style={{ display: 'block', marginBottom: '8px' }}>
          Who do you want to meet? <span style={{ color: 'var(--text-muted)' }}>*</span>
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
          {(['Men', 'Women', 'Everyone'] as const).map((pref) => (
            <button
              key={pref}
              type="button"
              onClick={() => setInterestedIn(pref)}
              className="btn"
              style={{
                backgroundColor: interestedIn === pref ? 'var(--action-primary)' : 'var(--surface-primary)',
                color: interestedIn === pref ? 'var(--action-primary-text)' : 'var(--text-primary)',
                borderColor: interestedIn === pref ? 'var(--action-primary)' : 'var(--border-subtle)',
              }}
            >
              {pref}
            </button>
          ))}
        </div>
      </div>

      {/* Bio / About */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <label htmlFor="bio" className="type-controls">
            About you
          </label>
          <span className="type-meta">{bio.length} / 160</span>
        </div>
        <textarea
          id="bio"
          rows={3}
          maxLength={160}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short note about yourself..."
          className="form-textarea"
        />
      </div>

      {/* Interests */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <label className="type-controls">Interests (Optional, max 5)</label>
          <span className="type-meta">{interests.length} / 5 selected</span>
        </div>

        {/* Selected chips */}
        {interests.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {interests.map((item) => (
              <span
                key={item}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: 'var(--text-primary)',
                  color: 'var(--surface-primary)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                }}
              >
                {item}
                <button
                  type="button"
                  onClick={() => toggleInterest(item)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--surface-primary)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                  aria-label={`Remove ${item}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Common Interest suggestions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {COMMON_INTERESTS.filter((item) => !interests.includes(item)).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleInterest(item)}
              style={{
                backgroundColor: 'var(--surface-soft)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-primary)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                cursor: 'pointer',
              }}
            >
              + {item}
            </button>
          ))}
        </div>

        {/* Custom interest input */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Add custom interest..."
            value={customInterest}
            onChange={(e) => setCustomInterest(e.target.value)}
            className="form-input"
            style={{ fontSize: '13px', padding: '6px 10px' }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustomInterest(e);
              }
            }}
          />
          <button
            type="button"
            onClick={handleAddCustomInterest}
            className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: '13px' }}
          >
            Add
          </button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '20px', marginTop: '10px' }}>
        <button
          type="submit"
          disabled={loading || isUnderAge}
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '16px' }}
        >
          {loading ? 'Saving...' : isEditMode ? 'Save Changes' : 'Complete Profile'}
        </button>
      </div>
    </form>
  );
}
