import React, { useEffect } from 'react';
import ProfileForm from '@/components/ProfileForm';

const Profile = () => {
  useEffect(() => {
    document.title = "Profile Settings - Bajawu";
    const metaDesc = document.querySelector('meta[name="description"]');
    const content = "Manage your profile information and settings";
    if (metaDesc) metaDesc.setAttribute("content", content);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = content;
      document.head.appendChild(m);
    }
    const linkCanonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (linkCanonical) linkCanonical.href = window.location.href;
    else {
      const l = document.createElement("link");
      l.rel = "canonical";
      l.href = window.location.href;
      document.head.appendChild(l);
    }
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your personal information and account settings.</p>
      </header>
      
      <ProfileForm />
    </div>
  );
};

export default Profile;