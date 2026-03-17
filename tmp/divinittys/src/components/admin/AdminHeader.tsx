'use client';

import { Bell, Menu } from 'lucide-react';
import { useState } from 'react';

export default function AdminHeader() {
  return (
    <header className="h-16 border-b border-border bg-card flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <button className="lg:hidden p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <p className="font-sans text-xs text-muted-foreground">Panel Administrativo</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground">
          <Bell className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-rose-400 flex items-center justify-center text-white text-xs font-bold">
          A
        </div>
      </div>
    </header>
  );
}
