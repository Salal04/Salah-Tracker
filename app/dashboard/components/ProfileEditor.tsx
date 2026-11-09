"use client";

import { Camera, Check, UserRound, X } from "lucide-react";
import { useState } from "react";
import type { PrayerLocation, SchoolOfThought, UserProfile } from "@/lib/types";

function optimizeImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 320 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(objectUrl); reject(new Error("Could not process this image.")); return; }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Could not read this image.")); };
    image.src = objectUrl;
  });
}

export function ProfileEditor({ profile, prayerLocation, driveConnected, required = false, onSave, onClose, onConnectGoogle }: { profile: UserProfile; prayerLocation: PrayerLocation; driveConnected: boolean; required?: boolean; onSave: (profile: UserProfile) => void; onClose: () => void; onConnectGoogle?: () => void }) {
  const [name, setName] = useState(profile.name);
  const [image, setImage] = useState(profile.image);
  const [gender, setGender] = useState(profile.gender || "");
  const [schoolOfThought, setSchoolOfThought] = useState<SchoolOfThought | "">(profile.schoolOfThought || "");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const initial = name.trim().slice(0, 1).toUpperCase() || "U";
  const chooseImage = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    setProcessing(true); setError("");
    try { setImage(await optimizeImage(file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not use this image."); }
    finally { setProcessing(false); }
  };
  return <div className={`profile-modal-backdrop ${required ? "required" : ""}`} onMouseDown={(event) => { if (!required && event.target === event.currentTarget) onClose(); }}>
    <section className="profile-modal" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
      {!required && <button className="profile-modal-close" type="button" onClick={onClose} aria-label="Close profile editor"><X size={18} /></button>}
      <div className="profile-modal-avatar">{image ? <img src={image} alt="Profile preview" /> : <span>{initial}</span>}</div>
      <h2 id="profile-modal-title">{required ? "Set up your profile" : "Your profile"}</h2>
      <p>{required ? "Enter a name to start using the tracker. Other profile details and a photo are optional." : "Edit your name and optional profile details."}</p>
      <label className="profile-field">Display name <span aria-hidden="true">*</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Your name" autoFocus required aria-required="true" /></label>
      <label className="profile-field">Gender <span>(optional)</span><input value={gender} onChange={(event) => setGender(event.target.value)} maxLength={60} placeholder="Gender" /></label>
      <label className="profile-field">School of thought <span>(optional)</span><select value={schoolOfThought} onChange={(event) => setSchoolOfThought(event.target.value as SchoolOfThought | "")}><option value="">Not set</option><option>Hanafi</option><option>Shafi&apos;i</option><option>Maliki</option><option>Hanbali</option><option>Other</option><option>Prefer not to say</option></select></label>
      <div className="profile-field profile-location-field">Prayer location <span>(linked)</span><div className="profile-location-grid"><input value={prayerLocation.city} readOnly aria-label="Prayer location city" /><input value={prayerLocation.country} readOnly aria-label="Prayer location country" /></div><small>Change this in Prayer times settings.</small></div>
      <div className="profile-image-actions"><label className="profile-image-button"><Camera size={15} />{processing ? "Preparing image..." : "Choose photo"}<input type="file" accept="image/*" onChange={(event) => void chooseImage(event.target.files?.[0])} /></label>{image && <button type="button" className="profile-clear-image" onClick={() => setImage("")}>Remove photo</button>}</div>
      <small className="profile-storage-note"><UserRound size={13} />{driveConnected ? "Saved in your browser and Google Drive backup." : "Saved only in this browser until Google Drive is connected."}</small>
      {error && <p className="profile-error" role="alert">{error}</p>}
      {required && onConnectGoogle && !driveConnected && <button type="button" className="profile-google-button" onClick={onConnectGoogle}>Continue with Google to fill your profile</button>}
      <div className="profile-modal-actions">{!required && <button type="button" className="profile-cancel" onClick={onClose}>Cancel</button>}<button type="button" className="profile-save" disabled={processing || !name.trim()} onClick={() => onSave({ name: name.trim(), image, ...(gender.trim() ? { gender: gender.trim() } : {}), ...(schoolOfThought ? { schoolOfThought } : {}), location: { city: prayerLocation.city, country: prayerLocation.country } })}><Check size={15} />{required ? "Continue" : "Save profile"}</button></div>
    </section>
  </div>;
}
