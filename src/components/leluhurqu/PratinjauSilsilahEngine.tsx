import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import {
  Printer,
  Minus,
  Plus,
  Maximize,
  Microchip,
  Layers,
  CircleDot,
  FileText,
  BadgeCheck,
  Share2,
  ChevronRight,
  Eye,
  Check,
  RefreshCw,
  User,
  Users,
  Sparkles,
  ArrowLeft,
  X,
  Heart,
  MapPin,
  Calendar,
  Home,
  SlidersHorizontal,
  Compass,
  Download
} from 'lucide-react';
import { FamilyMember } from './LeluhurQuView';

export type PaperSize = 'A0' | 'A1' | 'A2' | 'A3' | 'A4';
export type PaperOrientation = 'landscape' | 'portrait';
export type CardDisplayMode = 'only_name' | 'photo_bio' | 'complete';

export interface TreeNodeData {
  id: string;
  name: string;
  nickname?: string;
  binBinti?: string;
  title: string;
  photo?: string;
  gender: 'L' | 'P';
  birthYear?: string;
  deathYear?: string;
  birthDate?: string;
  deathDate?: string;
  status?: string;
  origin?: string;
  address?: string;
  role?: string;
  kinshipTitle?: string;
  notes?: string;
  generation?: number;
  
  // Spouse information (User & Pasangan)
  hasSpouse?: boolean;
  spouse?: string;
  spousePhoto?: string;
  spouseBinBinti?: string;
  spouseGender?: 'L' | 'P';
  spouseBirthYear?: string;
  spouseDeathYear?: string;
  spouseStatus?: string;
  spouseOrigin?: string;
  spouseAddress?: string;
  
  children?: TreeNodeData[];
}

interface PaperSpec {
  code: PaperSize;
  name: string;
  widthMm: number;
  heightMm: number;
  landscapePx: { width: number; height: number };
  portraitPx: { width: number; height: number };
  description: string;
  defaultZoom: number;
}

const PAPER_SPECS: Record<PaperSize, PaperSpec> = {
  A0: {
    code: 'A0',
    name: 'A0 (Super Poster)',
    widthMm: 1189,
    heightMm: 841,
    landscapePx: { width: 2200, height: 1556 },
    portraitPx: { width: 1556, height: 2200 },
    description: '1189 × 841 mm • Cetak Poster Raksasa Dinding & Spanduk Trah Besar',
    defaultZoom: 0.45,
  },
  A1: {
    code: 'A1',
    name: 'A1 (Poster Besar)',
    widthMm: 841,
    heightMm: 594,
    landscapePx: { width: 1800, height: 1273 },
    portraitPx: { width: 1273, height: 1800 },
    description: '841 × 594 mm • Bagan Silsilah Lengkap Ukuran Besar Pigura',
    defaultZoom: 0.55,
  },
  A2: {
    code: 'A2',
    name: 'A2 (Poster Medium)',
    widthMm: 594,
    heightMm: 420,
    landscapePx: { width: 1500, height: 1061 },
    portraitPx: { width: 1061, height: 1500 },
    description: '594 × 420 mm • Format Peta Silsilah Pigura Dinding Ruang Tamu',
    defaultZoom: 0.65,
  },
  A3: {
    code: 'A3',
    name: 'A3 (Buku Besar / Tabloid)',
    widthMm: 420,
    heightMm: 297,
    landscapePx: { width: 1250, height: 884 },
    portraitPx: { width: 884, height: 1250 },
    description: '420 × 297 mm • Format Buku Silsilah Lebar & Lembar Meja Registri',
    defaultZoom: 0.8,
  },
  A4: {
    code: 'A4',
    name: 'A4 (Standar Dokumen)',
    widthMm: 297,
    heightMm: 210,
    landscapePx: { width: 1000, height: 707 },
    portraitPx: { width: 707, height: 1000 },
    description: '297 × 210 mm • Standar Map, Arsip Dokumen & Cetak Printer Rumahan',
    defaultZoom: 1.0,
  },
};

interface PratinjauSilsilahEngineProps {
  members: FamilyMember[];
  onClose?: () => void;
  onSelectMember?: (memberId: string) => void;
  trahName?: string;
  isDark?: boolean;
}

export const PratinjauSilsilahEngine: React.FC<PratinjauSilsilahEngineProps> = ({
  members,
  onClose,
  onSelectMember,
  trahName = 'Trah LeluhurQu',
  isDark = false,
}) => {
  // State: Skin, Zoom, Ukuran Kertas A0 - A4, Orientasi & Pilihan Card
  const [currentSkin, setCurrentSkin] = useState<'pcb' | 'compact' | 'stack' | 'radial'>('pcb');
  const [currentZoom, setCurrentZoom] = useState<number>(1.0);
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<PaperOrientation>('landscape');
  
  // Pilihan Card yang Tampil (User Request):
  // 1. hanya nama ('only_name')
  // 2. Foto (user dan pasangan), nama, tahun lahir/tahun wafat, kota domisili ('photo_bio')
  // 3. card lengkap ('complete')
  const [cardDisplayMode, setCardDisplayMode] = useState<CardDisplayMode>('photo_bio');
  const [activeRootId, setActiveRootId] = useState<string>('');

  const containerRef = useRef<HTMLDivElement>(null);
  const paperSheetRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const activePaperSpec = PAPER_SPECS[paperSize];
  const paperDimensions = orientation === 'landscape' ? activePaperSpec.landscapePx : activePaperSpec.portraitPx;
  const paperMm = orientation === 'landscape' 
    ? { w: activePaperSpec.widthMm, h: activePaperSpec.heightMm }
    : { w: activePaperSpec.heightMm, h: activePaperSpec.widthMm };

  // Cari semua kandidat root (tanpa parentId)
  const rootMembers = useMemo(() => {
    if (members.length === 0) return [];
    const idSet = new Set(members.map((m) => m.id));
    const roots = members.filter((m) => !m.parentId || !idSet.has(m.parentId));
    return roots.length > 0 ? roots : [members[0]];
  }, [members]);

  // Set default active root
  useEffect(() => {
    if (rootMembers.length > 0 && !activeRootId) {
      setActiveRootId(rootMembers[0].id);
    }
  }, [rootMembers, activeRootId]);

  // Bangun struktur pohon hirarki lengkap dari data anggota & pasangan
  const familyTree = useMemo<TreeNodeData>(() => {
    if (members.length === 0) {
      return {
        id: 'root-demo',
        name: 'Abah Karta',
        nickname: 'Aki Karta',
        binBinti: 'bin Abdul Ghani',
        title: 'Leluhur Utama (Generasi 1)',
        photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        gender: 'L',
        birthYear: '1948',
        status: 'Hidup',
        origin: 'Cilimus, Kuningan',
        address: 'Jl. Pasarean No. 4, Cilimus',
        hasSpouse: true,
        spouse: 'Emak Rohanah',
        spousePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        spouseBinBinti: 'binti Mansur',
        spouseGender: 'P',
        spouseBirthYear: '1952',
        spouseDeathYear: '2019',
        spouseStatus: 'Almarhum',
        spouseOrigin: 'Cilimus, Kuningan',
        children: [
          {
            id: 'c1',
            name: 'Hendriana',
            nickname: 'Bageur',
            binBinti: 'bin Karta',
            title: 'Kepala Keluarga',
            gender: 'L',
            birthYear: '1985',
            status: 'Hidup',
            origin: 'Kuningan / Bogor',
            address: 'Nanggerang Indah Residence Blok A No. 12',
            hasSpouse: true,
            spouse: 'Siti Nurhaliza',
            spouseBinBinti: 'binti Suryana',
            spouseGender: 'P',
            spouseBirthYear: '1988',
            spouseStatus: 'Hidup',
            spouseOrigin: 'Dramaga, Bogor',
            children: [
              {
                id: 'c1_1',
                name: 'Rizky Al-Fathir',
                binBinti: 'bin Hendriana',
                title: 'Putra Sulung (Cikal)',
                gender: 'L',
                birthYear: '2012',
                status: 'Hidup',
                origin: 'Bogor',
              },
              {
                id: 'c1_2',
                name: 'Nabila Zahra',
                binBinti: 'binti Hendriana',
                title: 'Putri Bungsu',
                gender: 'P',
                birthYear: '2016',
                status: 'Hidup',
                origin: 'Bogor',
              },
            ],
          },
          {
            id: 'c2',
            name: 'Mang Dede Supriatna',
            binBinti: 'bin Karta',
            title: 'Paman (Adik)',
            gender: 'L',
            birthYear: '1990',
            status: 'Hidup',
            origin: 'Kuningan',
            children: [],
          },
        ],
      };
    }

    const selectedRoot =
      rootMembers.find((r) => r.id === activeRootId) || rootMembers[0] || members[0];

    const buildSubTree = (member: FamilyMember, depth: number): TreeNodeData => {
      const rawChildren = members.filter((m) => m.parentId === member.id);
      const sortedChildren = rawChildren.sort((a, b) => (a.birthOrder || 0) - (b.birthOrder || 0));

      let displayTitle =
        member.kinshipTitle || (depth === 1 ? 'Leluhur Utama (G1)' : `Generasi ${depth}`);
      if (member.role) displayTitle = member.role;

      // Cari data pasangan (spouse)
      let hasSpouse = false;
      let spouseName: string | undefined = undefined;
      let spousePhoto: string | undefined = undefined;
      let spouseBinBinti: string | undefined = undefined;
      let spouseGender: 'L' | 'P' = member.gender === 'L' ? 'P' : 'L';
      let spouseBirthYear: string | undefined = undefined;
      let spouseDeathYear: string | undefined = undefined;
      let spouseStatus: string | undefined = undefined;
      let spouseOrigin: string | undefined = undefined;
      let spouseAddress: string | undefined = undefined;

      if (member.spouses && member.spouses.length > 0) {
        hasSpouse = true;
        const sp = member.spouses[0];
        spouseName = sp.name;
        spousePhoto = sp.photo;
        spouseBinBinti = sp.binBinti;
        spouseGender = sp.gender || spouseGender;
        spouseBirthYear = sp.birthYear;
        spouseDeathYear = sp.deathYear;
        spouseStatus = sp.status;
        spouseOrigin = sp.origin;

        // Cari jika pasangan juga terdaftar penuh di members
        const fullSpouse = members.find(
          (m) => m.id === sp.id || m.name.toLowerCase() === sp.name.toLowerCase()
        );
        if (fullSpouse) {
          if (!spousePhoto && fullSpouse.photo) spousePhoto = fullSpouse.photo;
          if (!spouseBinBinti && fullSpouse.binBinti) spouseBinBinti = fullSpouse.binBinti;
          if (!spouseBirthYear && fullSpouse.birthYear) spouseBirthYear = fullSpouse.birthYear;
          if (!spouseDeathYear && fullSpouse.deathYear) spouseDeathYear = fullSpouse.deathYear;
          if (!spouseStatus && fullSpouse.status) spouseStatus = fullSpouse.status;
          if (!spouseOrigin && fullSpouse.origin) spouseOrigin = fullSpouse.origin;
          if (!spouseAddress && fullSpouse.address) spouseAddress = fullSpouse.address;
        }
      } else if (member.spouseId) {
        const fullSpouse = members.find((m) => m.id === member.spouseId);
        if (fullSpouse) {
          hasSpouse = true;
          spouseName = fullSpouse.name;
          spousePhoto = fullSpouse.photo;
          spouseBinBinti = fullSpouse.binBinti;
          spouseGender = fullSpouse.gender;
          spouseBirthYear = fullSpouse.birthYear;
          spouseDeathYear = fullSpouse.deathYear;
          spouseStatus = fullSpouse.status;
          spouseOrigin = fullSpouse.origin;
          spouseAddress = fullSpouse.address;
        }
      }

      return {
        id: member.id,
        name: member.name,
        nickname: member.nickname,
        binBinti: member.binBinti,
        title: displayTitle,
        photo: member.photo,
        gender: member.gender,
        birthYear: member.birthYear,
        deathYear: member.deathYear,
        birthDate: member.birthDate,
        status: member.status || 'Hidup',
        origin: member.origin,
        address: member.address,
        role: member.role,
        kinshipTitle: member.kinshipTitle,
        notes: member.notes,
        generation: depth,

        hasSpouse,
        spouse: spouseName,
        spousePhoto,
        spouseBinBinti,
        spouseGender,
        spouseBirthYear,
        spouseDeathYear,
        spouseStatus,
        spouseOrigin,
        spouseAddress,

        children: sortedChildren.map((c) => buildSubTree(c, depth + 1)),
      };
    };

    return buildSubTree(selectedRoot, 1);
  }, [members, rootMembers, activeRootId]);

  // Gambar rute orthogonal 90-derajat untuk PCB Skin
  const drawPCBRoutes = () => {
    if (currentSkin !== 'pcb') return;
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;

    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const containerRect = container.getBoundingClientRect();
    if (containerRect.width === 0 || containerRect.height === 0) return;

    svg.setAttribute('width', `${containerRect.width}`);
    svg.setAttribute('height', `${containerRect.height}`);

    const getCenterPin = (elementId: string, position: 'top' | 'bottom') => {
      const el = document.getElementById(elementId);
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const x = rect.left - containerRect.left + rect.width / 2;
      let y = rect.top - containerRect.top + rect.height / 2;
      if (position === 'top') y = rect.top - containerRect.top;
      if (position === 'bottom') y = rect.bottom - containerRect.top;
      return { x, y };
    };

    const createOrthogonalPath = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
      const midY = p1.y + (p2.y - p1.y) / 2;
      return `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`;
    };

    const renderBranchRoutes = (parent: TreeNodeData) => {
      if (!parent.children || parent.children.length === 0) return;
      const parentPin = getCenterPin(`node-${parent.id}`, 'bottom');

      parent.children.forEach((child) => {
        const childPin = getCenterPin(`node-${child.id}`, 'top');
        if (childPin.x === 0 && childPin.y === 0) return;

        const pathStr = createOrthogonalPath(parentPin, childPin);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathStr);
        path.setAttribute('stroke', '#10B981');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(path);

        // Rekursif ke anak berikutnya
        renderBranchRoutes(child);
      });
    };

    renderBranchRoutes(familyTree);
  };

  useLayoutEffect(() => {
    const timer = setTimeout(() => {
      drawPCBRoutes();
    }, 100);
    return () => clearTimeout(timer);
  }, [familyTree, currentSkin, currentZoom, paperSize, orientation, cardDisplayMode]);

  useEffect(() => {
    const handleResize = () => {
      drawPCBRoutes();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [currentSkin]);

  // Zoom Logic
  const changeZoom = (delta: number) => {
    setCurrentZoom((prev) => Math.max(0.15, Math.min(2.5, parseFloat((prev + delta).toFixed(2)))));
  };

  const autoFitToPaper = () => {
    if (!paperSheetRef.current) return;
    const availableWidth = window.innerWidth > 768 ? window.innerWidth - 80 : window.innerWidth - 24;
    const targetPaperWidth = paperDimensions.width;
    if (targetPaperWidth > 0) {
      const fitRatio = Math.max(0.2, Math.min(1.2, (availableWidth * 0.95) / targetPaperWidth));
      setCurrentZoom(parseFloat(fitRatio.toFixed(2)));
    }
  };

  // Saat ukuran kertas atau orientasi berubah, otomatis sesuaikan zoom ke ukuran kertas ideal
  const handlePaperChange = (newSize: PaperSize) => {
    setPaperSize(newSize);
    const spec = PAPER_SPECS[newSize];
    const availableWidth = window.innerWidth > 768 ? window.innerWidth - 80 : window.innerWidth - 24;
    const targetW = orientation === 'landscape' ? spec.landscapePx.width : spec.portraitPx.width;
    const fitRatio = Math.max(0.2, Math.min(1.2, (availableWidth * 0.92) / targetW));
    setCurrentZoom(parseFloat(fitRatio.toFixed(2)));
  };

  const handleOrientationChange = (newOrientation: PaperOrientation) => {
    setOrientation(newOrientation);
    const availableWidth = window.innerWidth > 768 ? window.innerWidth - 80 : window.innerWidth - 24;
    const targetW = newOrientation === 'landscape' ? activePaperSpec.landscapePx.width : activePaperSpec.portraitPx.width;
    const fitRatio = Math.max(0.2, Math.min(1.2, (availableWidth * 0.92) / targetW));
    setCurrentZoom(parseFloat(fitRatio.toFixed(2)));
  };

  // Cetak Silsilah Sesuai Kertas Terpilih
  const triggerPrint = () => {
    window.print();
  };

  const skinTitles = {
    pcb: 'PCB Auto-Router Circuit',
    compact: 'Compact Badge Hierarchy',
    stack: 'Vertical Stack Tree',
    radial: 'Radial Generational Orbit',
  };

  // =========================================================================
  // HELPER KOMPONEN KARTU SILSILAH DENGAN 3 PILIHAN TAMPILAN
  // =========================================================================
  const renderFamilyNodeCard = (
    node: TreeNodeData,
    options: {
      isRoot?: boolean;
      skin: 'pcb' | 'compact' | 'stack' | 'radial';
      badgeText?: string;
    }
  ) => {
    const isDeceased = node.status?.toLowerCase().includes('wafat') || node.status?.toLowerCase().includes('almarhum') || !!node.deathYear;
    const isSpouseDeceased = node.spouseStatus?.toLowerCase().includes('wafat') || node.spouseStatus?.toLowerCase().includes('almarhum') || !!node.spouseDeathYear;

    // -----------------------------------------------------------------------
    // PILIHAN 1: HANYA NAMA (MINIMALIS & SANGAT HEMAT RUANG)
    // -----------------------------------------------------------------------
    if (cardDisplayMode === 'only_name') {
      return (
        <div
          id={`node-${node.id}`}
          onClick={() => onSelectMember && onSelectMember(node.id)}
          className={`group transition-all duration-150 cursor-pointer text-center relative z-20 ${
            options.isRoot
              ? 'px-4 py-2 rounded-xl bg-slate-900 border-2 border-emerald-400 text-white shadow-md shadow-emerald-950/40 min-w-[190px]'
              : 'px-3 py-1.5 rounded-lg bg-slate-900/95 border border-slate-700 hover:border-emerald-400 text-slate-100 shadow-xs min-w-[150px]'
          }`}
        >
          {options.badgeText && (
            <span className="absolute -top-2 left-2 bg-slate-800 text-emerald-400 text-[8px] font-mono font-bold px-1.5 py-0.2 rounded border border-slate-700">
              {options.badgeText}
            </span>
          )}
          <div className="flex items-center justify-center gap-1.5">
            <span className={`font-black text-xs ${options.isRoot ? 'text-emerald-300' : 'text-slate-100'}`}>
              {node.name}
            </span>
            {isDeceased && <span className="text-[10px] text-slate-400" title="Almarhum">†</span>}
          </div>
          {node.hasSpouse && node.spouse && (
            <div className="text-[10px] text-pink-300 font-semibold mt-0.5 border-t border-slate-800/80 pt-0.5 flex items-center justify-center gap-1">
              <span>&amp; {node.spouse}</span>
              {isSpouseDeceased && <span className="text-[9px] text-slate-400">†</span>}
            </div>
          )}
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // PILIHAN 2: FOTO (USER DAN PASANGAN), NAMA, TAHUN LAHIR/WAFAT, KOTA DOMISILI
    // -----------------------------------------------------------------------
    if (cardDisplayMode === 'photo_bio') {
      return (
        <div
          id={`node-${node.id}`}
          onClick={() => onSelectMember && onSelectMember(node.id)}
          className={`group transition-all duration-200 cursor-pointer relative z-20 rounded-2xl p-2.5 text-center shadow-lg ${
            options.isRoot
              ? 'bg-slate-900 border-2 border-emerald-400 text-white min-w-[240px]'
              : 'bg-slate-900/95 border border-slate-700 hover:border-emerald-400 text-slate-100 min-w-[210px]'
          }`}
        >
          {options.badgeText && (
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-[9px] font-mono font-bold px-2 py-0.5 rounded-full shadow-xs">
              {options.badgeText}
            </span>
          )}

          {/* DUO AVATAR: USER & PASANGAN BERSANDING */}
          <div className="flex items-center justify-center gap-2 my-1">
            {/* Foto Anggota */}
            <div className="relative">
              <img
                src={
                  node.photo ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=059669&color=fff&size=96`
                }
                alt={node.name}
                className={`w-11 h-11 rounded-full object-cover border-2 shadow-xs ${
                  node.gender === 'L' ? 'border-blue-400' : 'border-emerald-400'
                }`}
              />
              {isDeceased && (
                <span className="absolute -bottom-1 -right-1 bg-slate-800 text-slate-200 text-[8px] px-1 rounded-full border border-slate-600">
                  †
                </span>
              )}
            </div>

            {/* Ikon Penghubung Pasangan jika ada */}
            {node.hasSpouse && (
              <div className="w-5 h-5 rounded-full bg-pink-950/80 border border-pink-500/50 flex items-center justify-center text-[10px] text-pink-400 shrink-0">
                ♥
              </div>
            )}

            {/* Foto Pasangan jika ada */}
            {node.hasSpouse && (
              <div className="relative">
                <img
                  src={
                    node.spousePhoto ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(node.spouse || 'Pasangan')}&background=db2777&color=fff&size=96`
                  }
                  alt={node.spouse || 'Pasangan'}
                  className={`w-11 h-11 rounded-full object-cover border-2 shadow-xs ${
                    node.spouseGender === 'L' ? 'border-blue-400' : 'border-pink-400'
                  }`}
                />
                {isSpouseDeceased && (
                  <span className="absolute -bottom-1 -right-1 bg-slate-800 text-slate-200 text-[8px] px-1 rounded-full border border-slate-600">
                    †
                  </span>
                )}
              </div>
            )}
          </div>

          {/* NAMA USER & PASANGAN */}
          <div className="mt-1">
            <h4 className="font-extrabold text-xs text-white leading-tight">
              {node.name}
            </h4>
            {node.hasSpouse && node.spouse && (
              <p className="text-[11px] font-bold text-pink-300 leading-tight">
                &amp; {node.spouse}
              </p>
            )}
          </div>

          {/* TAHUN LAHIR / TAHUN WAFAT */}
          <div className="mt-1 flex items-center justify-center gap-1.5 text-[10px] text-emerald-300 font-mono">
            <Calendar className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>
              {node.birthYear ? `L. ${node.birthYear}` : ''}
              {node.deathYear ? ` – ${node.deathYear} (†)` : node.birthYear ? ' (Hidup)' : 'Tahun tidak tercatat'}
            </span>
          </div>

          {/* KOTA DOMISILI */}
          {(node.origin || node.address) && (
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-slate-300 truncate max-w-[200px] mx-auto">
              <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate">{node.origin || node.address}</span>
            </div>
          )}
        </div>
      );
    }

    // -----------------------------------------------------------------------
    // PILIHAN 3: CARD LENGKAP (FULL DETIL LENGKAP BIN/BINTI, KEKERABATAN, ALAMAT)
    // -----------------------------------------------------------------------
    return (
      <div
        id={`node-${node.id}`}
        onClick={() => onSelectMember && onSelectMember(node.id)}
        className={`group transition-all duration-200 cursor-pointer relative z-20 rounded-2xl p-3 text-left shadow-xl ${
          options.isRoot
            ? 'bg-slate-900 border-2 border-emerald-400 text-white min-w-[290px]'
            : 'bg-slate-900/95 border border-slate-700 hover:border-emerald-400 text-slate-100 min-w-[270px]'
        }`}
      >
        {/* Header Badge */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
          <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border border-emerald-500/30">
            {options.badgeText || (options.isRoot ? 'LELUHUR UTAMA' : `GENERASI ${node.generation || 2}`)}
          </span>
          <span className="text-[10px] text-slate-400 font-semibold truncate max-w-[120px]">
            {node.kinshipTitle || node.title}
          </span>
        </div>

        {/* Duo Avatar & Biodata Lengkap */}
        <div className="flex gap-2.5">
          {/* Avatar User */}
          <div className="relative shrink-0">
            <img
              src={
                node.photo ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(node.name)}&background=059669&color=fff&size=96`
              }
              alt={node.name}
              className={`w-12 h-12 rounded-xl object-cover border-2 shadow-xs ${
                node.gender === 'L' ? 'border-blue-400' : 'border-emerald-400'
              }`}
            />
            <span
              className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-slate-900 flex items-center justify-center text-[7px] text-white font-bold ${
                isDeceased ? 'bg-slate-500' : 'bg-emerald-500'
              }`}
              title={isDeceased ? 'Almarhum/Wafat' : 'Masih Hidup'}
            >
              {isDeceased ? '†' : '✓'}
            </span>
          </div>

          {/* Identitas Anggota Utama */}
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-xs text-white leading-tight truncate">
              {node.name}
            </h4>
            {node.binBinti && (
              <p className="text-[10px] text-emerald-400 font-mono truncate">{node.binBinti}</p>
            )}
            <p className="text-[9px] text-slate-400 mt-0.5 font-mono">
              {node.birthYear ? `Lahir: ${node.birthYear}` : ''}
              {node.deathYear ? ` • Wafat: ${node.deathYear}` : ''}
              {!node.deathYear && node.birthYear ? ' • (Hidup)' : ''}
            </p>
          </div>
        </div>

        {/* Pasangan Info Card jika Menikah */}
        {node.hasSpouse && node.spouse && (
          <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 bg-slate-950/60 p-2 rounded-xl">
            <img
              src={
                node.spousePhoto ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(node.spouse)}&background=db2777&color=fff&size=80`
              }
              alt={node.spouse}
              className={`w-8 h-8 rounded-lg object-cover border shrink-0 ${
                node.spouseGender === 'L' ? 'border-blue-400' : 'border-pink-400'
              }`}
            />
            <div className="min-w-0 flex-1">
              <span className="text-[8px] font-bold uppercase text-pink-400 block tracking-wider">Pasangan Hidup</span>
              <p className="text-[11px] font-bold text-white truncate leading-tight">{node.spouse}</p>
              {node.spouseBinBinti && (
                <p className="text-[9px] text-slate-400 font-mono truncate">{node.spouseBinBinti}</p>
              )}
            </div>
            {isSpouseDeceased && (
              <span className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded font-mono">
                Alm
              </span>
            )}
          </div>
        )}

        {/* Domisili & Alamat */}
        {(node.origin || node.address) && (
          <div className="mt-2 text-[9px] text-slate-300 flex items-start gap-1 bg-slate-800/50 px-2 py-1.5 rounded-lg">
            <MapPin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {node.address ? `${node.address}` : ''}
              {node.origin && node.address ? ` (${node.origin})` : node.origin}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`flex flex-col min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-900 text-slate-100'} select-none animate-in fade-in duration-200`}>
      {/* Dynamic Print CSS for chosen Paper Size & Orientation */}
      <style>{`
        @media print {
          @page {
            size: ${paperSize.toLowerCase()} ${orientation};
            margin: 8mm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
          .print-area-wrapper {
            padding: 0 !important;
            margin: 0 !important;
            min-height: auto !important;
            background: white !important;
          }
          .paper-sheet {
            transform: none !important;
            border: none !important;
            box-shadow: none !important;
            width: 100% !important;
            min-height: auto !important;
            background: white !important;
            color: black !important;
          }
        }
      `}</style>

      {/* 1. TOP TOOLBAR BAR (NO PRINT) */}
      <header className="no-print bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-3.5 py-2.5 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Branding & Back */}
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
                title="Tutup Pratinjau & Kembali ke Editor"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-amber-400 flex items-center justify-center text-slate-950 font-black shadow-md">
              <Microchip className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h1 className="font-extrabold text-sm sm:text-base text-white leading-tight flex items-center gap-2">
                <span>Pratinjau Silsilah Trah</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-0.5 rounded-full font-mono border border-emerald-500/30 font-bold">
                  Kertas {paperSize}
                </span>
              </h1>
              <p className="text-[10px] text-slate-400">
                Pohon Silsilah Otomatis Sesuai Ukuran Kertas A0 s.d. A4 ({paperMm.w} × {paperMm.h} mm)
              </p>
            </div>
          </div>

          {/* Scale & Print Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Zoom Controls & Pas Kertas */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-1 flex items-center gap-1.5 shadow-inner">
              <button
                onClick={() => changeZoom(-0.05)}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs text-slate-200 transition cursor-pointer"
                title="Perkecil Zoom"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono w-12 text-center text-emerald-400 font-extrabold">
                {Math.round(currentZoom * 100)}%
              </span>
              <button
                onClick={() => changeZoom(0.05)}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-xs text-slate-200 transition cursor-pointer"
                title="Perbesar Zoom"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={autoFitToPaper}
                className="px-2.5 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 text-xs font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer"
                title="Sesuaikan otomatis agar seluruh lembar pas di layar"
              >
                <Maximize className="w-3 h-3 text-[#5eead4]" />
                <span className="text-[11px]">Pas Kertas</span>
              </button>
            </div>

            {/* Print Button */}
            <button
              onClick={triggerPrint}
              className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs px-3.5 py-2 rounded-xl shadow-md shadow-emerald-900/30 flex items-center gap-2 transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak {paperSize}</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-TOOLBAR LENGKAP: PILIHAN KERTAS A0-A4, PILIHAN CARD, & SKIN SELECTOR (NO PRINT) */}
      <div className="no-print bg-slate-900/95 border-b border-slate-800 backdrop-blur px-3.5 py-2.5 space-y-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          
          {/* BARIS A: PILIHAN UKURAN KERTAS A0 - A4 + ORIENTASI */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
              <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-400 text-[11px] font-bold">Ukuran Kertas:</span>
              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                {(['A0', 'A1', 'A2', 'A3', 'A4'] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => handlePaperChange(size)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition cursor-pointer ${
                      paperSize === size
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientasi Kertas */}
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-xl border border-slate-800">
              <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
                <button
                  onClick={() => handleOrientationChange('landscape')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    orientation === 'landscape'
                      ? 'bg-slate-700 text-emerald-300 font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Landscape (Melebar)
                </button>
                <button
                  onClick={() => handleOrientationChange('portrait')}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer ${
                    orientation === 'portrait'
                      ? 'bg-slate-700 text-emerald-300 font-extrabold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Portrait (Tegak)
                </button>
              </div>
            </div>
          </div>

          {/* BARIS B: PILIHAN CARD YANG TAMPIL (USER REQUIREMENT) */}
          <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800">
            <span className="text-slate-400 text-[11px] font-bold flex items-center gap-1">
              <Eye className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pilihan Card:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-700">
              <button
                onClick={() => setCardDisplayMode('only_name')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  cardDisplayMode === 'only_name'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Tampilkan hanya nama (Paling ringkas & hemat kertas)"
              >
                <span>1. Hanya Nama</span>
              </button>

              <button
                onClick={() => setCardDisplayMode('photo_bio')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  cardDisplayMode === 'photo_bio'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Foto (user dan pasangan), nama, tahun lahir/wafat, kota domisili"
              >
                <span>2. Foto Pasangan + Bio</span>
              </button>

              <button
                onClick={() => setCardDisplayMode('complete')}
                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  cardDisplayMode === 'complete'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
                title="Card lengkap dengan bin/binti, sebutan kekerabatan, alamat, status hidup"
              >
                <span>3. Card Lengkap</span>
              </button>
            </div>
          </div>

        </div>

        {/* BARIS C: SKIN VISUALISASI & PEMILIH CABANG ROOT */}
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5 text-xs pt-1 border-t border-slate-800/60">
          {/* Skin Selector Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
            <button
              onClick={() => setCurrentSkin('pcb')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition text-xs cursor-pointer ${
                currentSkin === 'pcb'
                  ? 'text-emerald-400 bg-slate-800 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Microchip className="w-3.5 h-3.5 text-emerald-400" />
              <span>1. Jalur PCB 90°</span>
            </button>

            <button
              onClick={() => setCurrentSkin('compact')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition text-xs cursor-pointer ${
                currentSkin === 'compact'
                  ? 'text-emerald-400 bg-slate-800 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BadgeCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>2. Compact Badge</span>
            </button>

            <button
              onClick={() => setCurrentSkin('stack')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition text-xs cursor-pointer ${
                currentSkin === 'stack'
                  ? 'text-emerald-400 bg-slate-800 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              <span>3. Vertical Stack</span>
            </button>

            <button
              onClick={() => setCurrentSkin('radial')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition text-xs cursor-pointer ${
                currentSkin === 'radial'
                  ? 'text-emerald-400 bg-slate-800 border border-slate-700 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5 text-purple-400" />
              <span>4. Radial Orbit</span>
            </button>
          </div>

          {/* Cabang Leluhur Utama Selector jika ada > 1 */}
          {rootMembers.length > 1 && (
            <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[11px] font-medium">Leluhur Utama:</span>
              <select
                value={activeRootId}
                onChange={(e) => setActiveRootId(e.target.value)}
                className="bg-slate-800 text-emerald-300 font-bold text-xs rounded px-2 py-0.5 border border-slate-700 outline-none cursor-pointer"
              >
                {rootMembers.map((rm) => (
                  <option key={rm.id} value={rm.id}>
                    {rm.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* 3. MAIN PREVIEW CANVAS AREA DENGAN TAMPILAN SESUAI KERTAS A0 - A4 */}
      <main className="flex-1 bg-slate-950 p-4 md:p-8 overflow-auto flex items-start justify-center print-area-wrapper min-h-[600px]">
        {/* INTERACTIVE PAPER CONTAINER BERDASARKAN UKURAN KERTAS A0 - A4 */}
        <div
          ref={paperSheetRef}
          style={{
            transform: `scale(${currentZoom})`,
            transformOrigin: 'top center',
            width: `${paperDimensions.width}px`,
            minHeight: `${paperDimensions.height}px`,
          }}
          className="paper-sheet rounded-2xl border-2 border-slate-700 transition-all duration-200 overflow-hidden relative shadow-2xl bg-white text-slate-800 flex flex-col justify-between"
        >
          {/* Architectural Crop Marks (Crosshairs) on 4 corners */}
          <div className="absolute top-2 left-2 text-slate-400 font-mono text-[9px] pointer-events-none select-none z-30">
            + {paperSize} {paperMm.w}×{paperMm.h}mm
          </div>
          <div className="absolute top-2 right-2 text-slate-400 font-mono text-[9px] pointer-events-none select-none z-30">
            + 300 DPI
          </div>
          <div className="absolute bottom-2 left-2 text-slate-400 font-mono text-[9px] pointer-events-none select-none z-30">
            + LeluhurQu Pusaka
          </div>
          <div className="absolute bottom-2 right-2 text-slate-400 font-mono text-[9px] pointer-events-none select-none z-30">
            +
          </div>

          {/* HEADER PAPER CETAK */}
          <div className="p-6 pb-3.5 border-b border-slate-200 flex justify-between items-start bg-slate-50/90 relative z-20">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-emerald-800 text-white font-mono px-2 py-0.5 rounded font-extrabold uppercase">
                  LEMBAR CETAK {paperSize} ({orientation.toUpperCase()})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Dimensi: {paperMm.w} × {paperMm.h} mm (ISO 216)
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5 mt-1">
                <span>BAGAN SILSILAH {trahName.toUpperCase()}</span>
                <span className="text-[11px] bg-slate-200 text-slate-800 font-mono px-2 py-0.5 rounded-full uppercase font-bold">
                  {skinTitles[currentSkin]}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Kitab Registri Nasab &bull; {members.length} Anggota Terdaftar &bull; Mode Card:{' '}
                <strong className="text-emerald-800">
                  {cardDisplayMode === 'only_name'
                    ? 'Hanya Nama'
                    : cardDisplayMode === 'photo_bio'
                    ? 'Foto User & Pasangan + Biodata'
                    : 'Card Lengkap Detil'}
                </strong>
              </p>
            </div>
            <div className="text-right text-[10px] text-slate-400 font-mono">
              <p>Dicetak: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
              <p>Format: Kertas {paperSize} Auto-Fit</p>
            </div>
          </div>

          {/* CONTENT AREA SILSILAH */}
          <div
            ref={containerRef}
            className={`flex-1 p-6 md:p-8 relative min-h-[550px] flex items-center justify-center ${
              currentSkin === 'pcb' ? 'bg-[#081410] text-white' : 'bg-white text-slate-800'
            }`}
          >
            {/* SVG Layer for 90-degree Orthogonal PCB Traces */}
            {currentSkin === 'pcb' && (
              <svg
                ref={svgRef}
                className="absolute inset-0 w-full h-full pointer-events-none z-10"
              />
            )}

            {/* Dynamic Skin Renderers */}
            <div className="w-full relative z-20 flex justify-center">
              {/* SKIN 1: PCB AUTO-ROUTER CIRCUIT */}
              {currentSkin === 'pcb' && (
                <div className="flex flex-col items-center gap-12 font-mono w-full">
                  {/* Root Node (IC Core) */}
                  {renderFamilyNodeCard(familyTree, {
                    isRoot: true,
                    skin: 'pcb',
                    badgeText: 'IC-ROOT (G1)',
                  })}

                  {/* Level 2 Children (Sub Chips) */}
                  {familyTree.children && familyTree.children.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-8 relative z-20 w-full">
                      {familyTree.children.map((child, idx) => (
                        <div key={child.id} className="flex flex-col items-center gap-8">
                          {renderFamilyNodeCard(child, {
                            isRoot: false,
                            skin: 'pcb',
                            badgeText: `PIN-${idx + 1} (G2)`,
                          })}

                          {/* Level 3 Children (Micro Pads) */}
                          {child.children && child.children.length > 0 && (
                            <div className="flex flex-wrap justify-center gap-3">
                              {child.children.map((grandChild, gIdx) => (
                                <div key={grandChild.id} className="flex flex-col items-center gap-4">
                                  {renderFamilyNodeCard(grandChild, {
                                    isRoot: false,
                                    skin: 'pcb',
                                    badgeText: `PAD-${gIdx + 1} (G3)`,
                                  })}

                                  {/* Level 4 Children (Cicit Pads) */}
                                  {grandChild.children && grandChild.children.length > 0 && (
                                    <div className="flex flex-wrap justify-center gap-2">
                                      {grandChild.children.map((greatGrandChild) => (
                                        <div key={greatGrandChild.id}>
                                          {renderFamilyNodeCard(greatGrandChild, {
                                            isRoot: false,
                                            skin: 'pcb',
                                            badgeText: 'CICIT (G4)',
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SKIN 2: COMPACT BADGE */}
              {currentSkin === 'compact' && (
                <div className="flex flex-col items-center gap-6 w-full">
                  {/* Root Compact Card */}
                  {renderFamilyNodeCard(familyTree, {
                    isRoot: true,
                    skin: 'compact',
                    badgeText: 'Leluhur Utama (G1)',
                  })}

                  <div className="w-0.5 h-6 bg-slate-300"></div>

                  {/* Branch Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 w-full">
                    {familyTree.children &&
                      familyTree.children.map((child, idx) => (
                        <div
                          key={child.id}
                          className="bg-slate-50/80 border border-slate-200 rounded-2xl p-3.5 shadow-sm flex flex-col items-center text-center hover:border-emerald-400 transition"
                        >
                          {renderFamilyNodeCard(child, {
                            isRoot: false,
                            skin: 'compact',
                            badgeText: `Cabang ${idx + 1}`,
                          })}

                          {child.children && child.children.length > 0 && (
                            <div className="w-full border-t border-slate-200 pt-3 mt-3 flex flex-col gap-2">
                              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider text-left">
                                Keturunan:
                              </span>
                              {child.children.map((gc) => (
                                <div key={gc.id}>
                                  {renderFamilyNodeCard(gc, {
                                    isRoot: false,
                                    skin: 'compact',
                                    badgeText: 'Cucu',
                                  })}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SKIN 3: VERTICAL STACK GRID */}
              {currentSkin === 'stack' && (
                <div className="flex flex-col gap-6 w-full max-w-5xl mx-auto">
                  {/* Level 1 Stack */}
                  {renderFamilyNodeCard(familyTree, {
                    isRoot: true,
                    skin: 'stack',
                    badgeText: 'Generasi I (Leluhur)',
                  })}

                  {/* Level 2 & 3 Vertical Stacks */}
                  {familyTree.children &&
                    familyTree.children.map((child) => (
                      <div
                        key={child.id}
                        className="bg-slate-50 border border-slate-200 rounded-2xl p-4 shadow-sm ml-4 sm:ml-8 relative space-y-3"
                      >
                        <div className="absolute -left-4 sm:-left-8 top-6 w-4 sm:w-8 h-0.5 bg-slate-300"></div>

                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-xs font-bold text-slate-800">
                            Sub-Trah: {child.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">Generasi II</span>
                        </div>

                        {renderFamilyNodeCard(child, {
                          isRoot: false,
                          skin: 'stack',
                          badgeText: 'Anak / G2',
                        })}

                        {/* Grandchildren Stacks */}
                        {child.children && child.children.length > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                            {child.children.map((gc) => (
                              <div key={gc.id}>
                                {renderFamilyNodeCard(gc, {
                                  isRoot: false,
                                  skin: 'stack',
                                  badgeText: 'Cucu / G3',
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              )}

              {/* SKIN 4: RADIAL WHEEL */}
              {currentSkin === 'radial' && (
                <div className="relative w-[560px] h-[560px] mx-auto flex items-center justify-center">
                  {/* Center Hub */}
                  <div className="absolute z-30 flex flex-col items-center justify-center">
                    {renderFamilyNodeCard(familyTree, {
                      isRoot: true,
                      skin: 'radial',
                      badgeText: 'PUSAT TRAH (G1)',
                    })}
                  </div>

                  {/* Outer Ring 1 (Children) */}
                  <div className="absolute w-[360px] h-[360px] rounded-full border-2 border-dashed border-emerald-500/40 flex items-center justify-center pointer-events-none"></div>
                  {familyTree.children &&
                    familyTree.children.map((child, idx) => {
                      const count = familyTree.children?.length || 1;
                      const angle = (idx / count) * 360;
                      const rad = (angle * Math.PI) / 180;
                      const x = Math.cos(rad) * 190;
                      const y = Math.sin(rad) * 190;

                      return (
                        <div
                          key={child.id}
                          style={{ transform: `translate(${x}px, ${y}px)` }}
                          className="absolute z-20 pointer-events-auto"
                        >
                          {renderFamilyNodeCard(child, {
                            isRoot: false,
                            skin: 'radial',
                            badgeText: `G2`,
                          })}
                        </div>
                      );
                    })}

                  {/* Outer Ring 2 (Decorative Orbit) */}
                  <div className="absolute w-[540px] h-[540px] rounded-full border border-slate-200 pointer-events-none"></div>
                </div>
              )}
            </div>
          </div>

          {/* FOOTER PAPER CETAK */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/90 flex justify-between items-center text-[11px] text-slate-500 font-medium relative z-20">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Silsilah Trah {trahName} &copy; 2026 &bull; Format Lembar {paperSize} ({paperMm.w} × {paperMm.h} mm)
              </span>
            </span>
            <span className="font-mono">
              Bagan Resmi &bull; Mode Card: {cardDisplayMode === 'only_name' ? 'Hanya Nama' : cardDisplayMode === 'photo_bio' ? 'Foto + Bio' : 'Lengkap'}
            </span>
          </div>
        </div>
      </main>

      {/* 4. FOOTER PANEL INFORMASI (NO PRINT) */}
      <footer className="no-print bg-slate-900 border-t border-slate-800 px-4 py-2.5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <BadgeCheck className="w-3.5 h-3.5" /> Standar Kertas ISO 216 ({paperSize})
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <Microchip className="w-3.5 h-3.5 text-amber-400" /> {paperMm.w} × {paperMm.h} mm
            </span>
            <span className="flex items-center gap-1 text-sky-400">
              <Eye className="w-3.5 h-3.5" /> Card: {cardDisplayMode === 'only_name' ? 'Hanya Nama' : cardDisplayMode === 'photo_bio' ? 'Foto Pasangan + Bio' : 'Card Lengkap'}
            </span>
          </div>
          <div className="text-slate-400 text-[11px]">
            Tips: Gunakan tombol <b className="text-emerald-400">Pas Kertas</b> untuk memuat seluruh bagan {paperSize} ke layar Anda.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PratinjauSilsilahEngine;
