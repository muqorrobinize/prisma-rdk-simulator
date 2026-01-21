import { useState, useEffect } from 'react';
import { 
  ShieldCheck, Activity, CheckCircle, XCircle, Factory, 
  Truck, Store, Map, FileText, Search, LayoutDashboard, 
  LogOut, Stethoscope, Database, 
  Lock, Zap, Wifi, WifiOff, 
  AlertTriangle, ChevronRight, User
} from 'lucide-react';

// --- TIPE DATA ---
type UserRole = 'developer' | 'manufacturer' | 'distributor' | 'doctor' | 'pharmacist' | null;

interface OffChainData {
  patientName: string;
  diagnosis: string;
  nik: string; 
}

interface BlockData {
  type: 'GENESIS' | 'PRODUCTION' | 'DISTRIBUTION' | 'PRESCRIPTION' | 'DISPENSE';
  id: string; 
  timestamp: string;
  drugName: string;
  drugCode: string; 
  quantity: number; 
  actor: string;
  location: string;
  targetLocation?: string;
  offChainPointer?: string; 
  status: 'stored' | 'in-transit' | 'active' | 'redeemed' | 'synced';
  hash: string;
}

interface Block {
  index: number;
  hash: string;
  previousHash: string;
  timestamp: string;
  data: BlockData;
  isLocal?: boolean; 
}

// --- KONSTANTA & SAMPLE DATA ---
const DRUG_CATALOG = [
  { name: "Cefixime 100mg", type: "Antibiotik Lini 3 (High Alert)", din: "DIN-KEMENKES-CFX3" },
  { name: "Amoxicillin 500mg", type: "Antibiotik Lini 1", din: "DIN-KEMENKES-AMX1" },
  { name: "Levofloxacin 500mg", type: "Antibiotik Lini 2", din: "DIN-KEMENKES-LVX2" },
  { name: "Meropenem Inj", type: "Antibiotik Lini Terakhir", din: "DIN-KEMENKES-MPN4" }
];

const LOCATIONS = [
  "BioFarma (Pusat)",
  "Gudang Dinas Kesehatan",
  "RSUP Dr. Sardjito",
  "Apotek Kimia Farma",
  "Puskesmas Tepus (Remote)"
];

// Data Off-Chain Dummy (Untuk simulasi dekripsi)
const SAMPLE_OFFCHAIN: Record<string, OffChainData> = {
  "IPFS-QmW2X9": { patientName: "Budi Santoso", diagnosis: "Infeksi Saluran Kemih (ISK)", nik: "3404011209880001" },
  "IPFS-QmY7Z3": { patientName: "Siti Aminah", diagnosis: "Pneumonia Komunitas", nik: "3302154401900002" }
};

// Data Blockchain Dummy (Agar dashboard tidak kosong)
const SAMPLE_BLOCKS: Block[] = [
  {
    index: 0,
    hash: "00000000000000000GENESIS00000000000000000",
    previousHash: "0",
    timestamp: "2025-01-01T00:00:00.000Z",
    data: {
      type: 'GENESIS', id: 'INIT', timestamp: "2025-01-01T00:00:00.000Z",
      drugName: 'SYSTEM', drugCode: 'SYS', quantity: 0, actor: 'SYSTEM',
      location: 'CLOUD', status: 'active', hash: 'GENESIS'
    }
  },
  {
    index: 1,
    hash: "00a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0123456789abcde",
    previousHash: "00000000000000000GENESIS00000000000000000",
    timestamp: "2025-10-15T08:30:00.000Z",
    data: {
      type: 'PRODUCTION', id: 'BATCH-2025-101', timestamp: "2025-10-15T08:30:00.000Z",
      drugName: 'Cefixime 100mg', drugCode: 'DIN-KEMENKES-CFX3', quantity: 5000,
      actor: 'BioFarma Corp', location: 'Pabrik Pusat', status: 'stored', hash: '...'
    }
  },
  {
    index: 2,
    hash: "00f9e8d7c6b5a432109876543210fedcba9876543210fedcba9876543210fedc",
    previousHash: "00a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcde",
    timestamp: "2025-10-20T14:15:00.000Z",
    data: {
      type: 'PRESCRIPTION', id: 'RX-99281', timestamp: "2025-10-20T14:15:00.000Z",
      drugName: 'Cefixime 100mg', drugCode: 'DIN-KEMENKES-CFX3', quantity: 15,
      actor: 'Dr. Spesialis Dalam', location: 'RSUP Dr. Sardjito',
      status: 'active', hash: '...', offChainPointer: "IPFS-QmW2X9"
    }
  }
];

// --- KOMPONEN UTAMA ---
const PrismaAdvanced = () => {
  const [blockchain, setBlockchain] = useState<Block[]>([]);
  const [offChainStorage, setOffChainStorage] = useState<Record<string, OffChainData>>({});
  const [localQueue, setLocalQueue] = useState<Block[]>([]); 
  
  const [currentUser, setCurrentUser] = useState<UserRole>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isOffline, setIsOffline] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<Block | null>(null);
  const [notif, setNotif] = useState<{msg: string, type: 'success'|'error'|'info'} | null>(null);
  const [showSmartContractModal, setShowSmartContractModal] = useState(false);
  const [contractStep, setContractStep] = useState(0);

  const [formRx, setFormRx] = useState({ patientName: '', nik: '', drugIdx: 0, qty: 10 });
  const [scanHash, setScanHash] = useState('');
  const [tempDispenseTarget, setTempDispenseTarget] = useState<Block | null>(null);

  // --- INISIALISASI SAMPLE DATA ---
  useEffect(() => {
    // Load sample data on mount
    setBlockchain(SAMPLE_BLOCKS);
    setOffChainStorage(SAMPLE_OFFCHAIN);
  }, []);

  // --- CRYPTO ENGINE ---
  const calculateHash = (idx: number, prevHash: string, time: string, dataStr: string) => {
    let hash = 0, i, chr;
    const str = `${idx}${prevHash}${time}${dataStr}`;
    if (str.length === 0) return hash.toString(16);
    for (i = 0; i < str.length; i++) {
      chr = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0; 
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  };

  const mintBlock = (dataPayload: Omit<BlockData, 'hash'>, privateData?: OffChainData) => {
    const timestamp = new Date().toISOString();
    let pointer = null;
    if (privateData) {
      pointer = `IPFS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      setOffChainStorage(prev => ({...prev, [pointer!]: privateData}));
    }

    const finalData: BlockData = {
      ...dataPayload,
      offChainPointer: pointer || undefined,
      timestamp,
      hash: '', 
      status: isOffline ? 'stored' : dataPayload.status 
    };

    const lastBlock = blockchain[blockchain.length - 1];
    const prevHash = lastBlock ? lastBlock.hash : "0000000000000000000000000000000000000000000000000000000000000000";
    const newIndex = (lastBlock?.index || 0) + 1;
    const newHash = calculateHash(newIndex, prevHash, timestamp, JSON.stringify(finalData));
    finalData.hash = newHash;

    const newBlock: Block = {
      index: newIndex,
      hash: newHash,
      previousHash: prevHash,
      timestamp,
      data: finalData,
      isLocal: isOffline
    };

    if (isOffline) {
      setLocalQueue(prev => [...prev, newBlock]);
      showNotif("Disimpan Lokal (Menunggu Koneksi)", 'info');
    } else {
      setBlockchain(prev => [...prev, newBlock]);
      if(privateData) showNotif("Data Pasien Terenkripsi (Off-Chain)", 'success');
      else showNotif("Blok Terverifikasi ke Ledger Nasional", 'success');
    }
  };

  // Bot Simulation Logic
  useEffect(() => {
    if (!isAutoMode || isOffline) return;
    const interval = setInterval(() => {
      const rand = Math.random();
      if (rand < 0.3) {
        mintBlock({
          type: 'PRODUCTION',
          id: `BATCH-${Date.now().toString().slice(-4)}`,
          drugName: 'Cefixime 100mg',
          drugCode: 'DIN-KEMENKES-CFX3',
          quantity: 500,
          actor: 'BioFarma (Bot)',
          location: 'BioFarma (Pusat)',
          status: 'stored',
          timestamp: ''
        });
      } else if (rand < 0.6) {
        mintBlock({
          type: 'PRESCRIPTION',
          id: `RX-${Date.now().toString().slice(-5)}`,
          drugName: 'Cefixime 100mg',
          drugCode: 'DIN-KEMENKES-CFX3',
          quantity: 10,
          actor: 'Dr. Bot Sp.PD',
          location: 'RSUP Dr. Sardjito',
          status: 'active',
          timestamp: ''
        }, { patientName: 'Anonim (Simulasi)', diagnosis: 'ISK', nik: '0000' });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoMode, isOffline, blockchain]);

  const handleSync = () => {
    if (localQueue.length === 0) return;
    let currentChain = [...blockchain];
    localQueue.forEach(b => {
      const last = currentChain[currentChain.length - 1];
      const newBlock = { ...b, previousHash: last.hash, isLocal: false, data: {...b.data, status: 'synced' as const} };
      currentChain.push(newBlock);
    });
    setBlockchain(currentChain);
    setLocalQueue([]);
    showNotif("Sinkronisasi Berhasil ke Server Pusat", 'success');
  };

  const handleCreateRx = () => {
    if (!formRx.patientName || !formRx.nik) {
      showNotif("Data Pasien (NIK & Nama) Wajib Diisi", 'error');
      return;
    }
    mintBlock({
      type: 'PRESCRIPTION',
      id: `RX-${Date.now().toString().slice(-6)}`,
      drugName: DRUG_CATALOG[formRx.drugIdx].name,
      drugCode: DRUG_CATALOG[formRx.drugIdx].din,
      quantity: formRx.qty,
      actor: currentUser === 'doctor' ? 'Dr. User Sp.PD' : 'Dev Doctor',
      location: 'Klinik Pratama',
      status: 'active',
      timestamp: ''
    }, {
      patientName: formRx.patientName,
      diagnosis: 'Infeksi Bakteri (Privasi)',
      nik: formRx.nik
    });
    setFormRx({...formRx, patientName: '', nik: ''});
  };

  const initSmartContractVerification = () => {
    const targetBlock = blockchain.find(b => b.data.id === scanHash && b.data.type === 'PRESCRIPTION');
    if (!targetBlock) {
      showNotif("Resep Tidak Ditemukan", 'error');
      return;
    }
    setTempDispenseTarget(targetBlock);
    setShowSmartContractModal(true);
    setContractStep(0);
    setTimeout(() => setContractStep(1), 1000); 
    setTimeout(() => {
       const isRedeemed = blockchain.some(b => b.data.type === 'DISPENSE' && b.data.id === targetBlock.data.id);
       if (isRedeemed) {
         setContractStep(4); 
         showNotif("GAGAL: Resep Sudah Pernah Digunakan!", 'error');
       } else {
         setContractStep(2); 
       }
    }, 2500);
    setTimeout(() => {
        if (contractStep !== 4) setContractStep(3); 
    }, 3500);
  };

  const executeDispense = () => {
    if (!tempDispenseTarget) return;
    mintBlock({
      type: 'DISPENSE',
      id: tempDispenseTarget.data.id,
      drugName: tempDispenseTarget.data.drugName,
      drugCode: tempDispenseTarget.data.drugCode,
      quantity: tempDispenseTarget.data.quantity,
      actor: currentUser === 'pharmacist' ? 'Apt. User, S.Farm' : 'Dev Pharm',
      location: 'Apotek Kimia Farma',
      status: 'redeemed',
      timestamp: ''
    });
    setShowSmartContractModal(false);
    setScanHash('');
    setTempDispenseTarget(null);
    showNotif("Obat Diserahkan & Transaksi Dikunci", 'success');
  };

  const showNotif = (msg: string, type: 'success'|'error'|'info') => {
    setNotif({msg, type});
    setTimeout(() => setNotif(null), 4000);
  };

  // --- UI RENDER ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden text-slate-800">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-teal-500 to-cyan-500"></div>
        
        <div className="z-10 w-full max-w-5xl grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6 animate-in slide-in-from-left duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700 text-xs font-bold uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4" />
              <span>Platform Nasional</span>
            </div>
            <div>
              <h1 className="text-6xl font-bold tracking-tight text-slate-900 mb-2">
                PRISMA
              </h1>
              <p className="text-xl text-slate-500 font-medium leading-relaxed">
                Pengawasan Distribusi Antibiotik<br/>
                Berbasis <span className="text-teal-600">Blockchain</span> & <span className="text-teal-600">SATUSEHAT</span>
              </p>
            </div>
            <p className="text-slate-500 text-sm max-w-md leading-relaxed">
              Solusi digital untuk mencegah resistensi antimikroba melalui transparansi rantai pasok dan validasi resep elektronik terintegrasi.
            </p>
            
            <div className="grid grid-cols-2 gap-4 pt-4">
               <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <Lock className="w-5 h-5 text-teal-600 mb-2"/>
                  <h3 className="font-bold text-slate-800 text-sm">Immutable Ledger</h3>
                  <p className="text-xs text-slate-500 mt-1">Data aman & tak tergantikan.</p>
               </div>
               <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <WifiOff className="w-5 h-5 text-teal-600 mb-2"/>
                  <h3 className="font-bold text-slate-800 text-sm">Offline-First</h3>
                  <p className="text-xs text-slate-500 mt-1">Siap untuk daerah terpencil.</p>
               </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-xl animate-in slide-in-from-right duration-700">
            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 pb-4 border-b border-slate-100">
              <User className="w-5 h-5 text-teal-600"/> Masuk Sebagai
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {[
                {id: 'manufacturer', label: 'Produsen Farmasi', icon: Factory, desc: 'Input Batch Produksi'},
                {id: 'distributor', label: 'Distribusi & Logistik', icon: Truck, desc: 'Pelacakan Pengiriman'},
                {id: 'doctor', label: 'Dokter & Nakes', icon: Stethoscope, desc: 'E-Prescription'},
                {id: 'pharmacist', label: 'Farmasi & Apotek', icon: Store, desc: 'Dispensing Obat'},
                {id: 'developer', label: 'Auditor Sistem', icon: Database, desc: 'Monitoring Jaringan'},
              ].map((role) => (
                <button
                  key={role.id}
                  onClick={() => { setCurrentUser(role.id as UserRole); setActiveTab('dashboard'); }}
                  className="flex items-center gap-4 p-3 rounded-lg border border-slate-100 hover:bg-teal-50 hover:border-teal-200 transition-all group text-left"
                >
                  <div className="p-2 rounded-md bg-slate-50 group-hover:bg-white text-slate-500 group-hover:text-teal-600 transition-colors">
                    <role.icon className="w-5 h-5"/>
                  </div>
                  <div>
                    <span className="block font-bold text-slate-700 text-sm group-hover:text-teal-700">{role.label}</span>
                    <span className="text-xs text-slate-400 group-hover:text-teal-600/70">{role.desc}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 ml-auto group-hover:text-teal-500"/>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 w-full py-4 text-center text-slate-400 text-[10px] font-medium border-t border-slate-200 bg-white/50 backdrop-blur-sm">
           © 2025 Kementerian Kesehatan RI (Simulasi) | PRISMA Project
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-100">
           <div className="flex flex-col">
             <span className="font-bold text-teal-700 tracking-tight text-xl leading-none">PRISMA</span>
             <span className="text-[9px] text-slate-400 font-medium tracking-widest mt-0.5">HEALTH CHAIN</span>
           </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] font-bold text-slate-400 uppercase px-4 mb-2 mt-2 tracking-wider">Menu Utama</div>
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab==='dashboard' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <LayoutDashboard className="w-4 h-4"/> Dashboard
          </button>
          <button onClick={() => setActiveTab('explorer')} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab==='explorer' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
            <Database className="w-4 h-4"/> Data Transaksi
          </button>
          
          <div className="text-[10px] font-bold text-slate-400 uppercase px-4 mb-2 mt-6 tracking-wider">Layanan</div>
          {(currentUser === 'developer' || currentUser === 'manufacturer') && (
            <button onClick={() => setActiveTab('production')} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab==='production' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Factory className="w-4 h-4"/> Input Produksi
            </button>
          )}
          {(currentUser === 'developer' || currentUser === 'doctor') && (
            <button onClick={() => setActiveTab('doctor')} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab==='doctor' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Stethoscope className="w-4 h-4"/> E-Resep
            </button>
          )}
          {(currentUser === 'developer' || currentUser === 'pharmacist') && (
            <button onClick={() => setActiveTab('pharmacy')} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${activeTab==='pharmacy' ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Store className="w-4 h-4"/> Farmasi (Dispense)
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
           <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-600">
                <User className="w-4 h-4"/>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 capitalize">{currentUser}</p>
                <p className="text-[10px] text-teal-600 flex items-center gap-1">● Terverifikasi</p>
              </div>
           </div>
           <button onClick={() => setCurrentUser(null)} className="w-full py-2 text-xs font-bold text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center gap-2">
             <LogOut className="w-3 h-3"/> Keluar
           </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative bg-slate-50">
        {/* HEADER */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-10 sticky top-0 shadow-sm">
          <div>
            <h2 className="text-base font-bold text-slate-800 capitalize">{activeTab === 'dashboard' ? 'Dashboard Nasional' : activeTab}</h2>
            <p className="text-[10px] text-slate-500">Sistem Monitoring Distribusi Antibiotik Terintegrasi</p>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
               onClick={() => {
                 if(isOffline && localQueue.length > 0) handleSync();
                 setIsOffline(!isOffline);
               }}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                 isOffline 
                 ? 'bg-red-50 border-red-200 text-red-600' 
                 : 'bg-teal-50 border-teal-200 text-teal-600'
               }`}
             >
               {isOffline ? <WifiOff className="w-3 h-3"/> : <Wifi className="w-3 h-3"/>}
               {isOffline ? 'Mode Offline' : 'Terhubung'}
               {isOffline && localQueue.length > 0 && <span className="ml-1 bg-red-500 text-white px-1.5 rounded-full text-[9px]">{localQueue.length}</span>}
             </button>

             <button 
               onClick={() => setIsAutoMode(!isAutoMode)}
               className={`p-2 rounded-full border transition-all ${isAutoMode ? 'bg-yellow-50 border-yellow-200 text-yellow-600' : 'bg-white border-slate-200 text-slate-400'}`}
               title="Simulasi Data Otomatis"
             >
               <Zap className="w-4 h-4"/>
             </button>
          </div>
        </header>

        {/* NOTIFICATION */}
        {notif && (
           <div className={`absolute top-20 right-8 z-50 px-5 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-top-2 border bg-white ${
             notif.type === 'success' ? 'border-teal-200 text-teal-800' : 
             notif.type === 'error' ? 'border-red-200 text-red-800' : 'border-blue-200 text-blue-800'
           }`}>
             {notif.type === 'success' ? <CheckCircle className="w-4 h-4 text-teal-500"/> : notif.type === 'error' ? <AlertTriangle className="w-4 h-4 text-red-500"/> : <Activity className="w-4 h-4 text-blue-500"/>}
             <span className="text-sm font-medium">{notif.msg}</span>
           </div>
        )}

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: "Total Produksi", val: blockchain.filter(b => b.data.type === 'PRODUCTION').reduce((acc, curr) => acc + curr.data.quantity, 0), unit: "Unit Obat", icon: Factory, color: "text-blue-600", bg: "bg-blue-50" },
                  { label: "Obat Tersalurkan", val: blockchain.filter(b => b.data.type === 'DISPENSE').reduce((acc, curr) => acc + curr.data.quantity, 0), unit: "Unit Ditebus", icon: Store, color: "text-teal-600", bg: "bg-teal-50" },
                  { label: "Resep Terverifikasi", val: blockchain.filter(b => b.data.type === 'DISPENSE').length, unit: "Transaksi", icon: FileText, color: "text-purple-600", bg: "bg-purple-50" },
                  { label: "Anomali", val: "0", unit: "Kasus", icon: AlertTriangle, color: "text-slate-600", bg: "bg-slate-100" },
                ].map((stat, i) => (
                  <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-start justify-between">
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">{stat.label}</p>
                      <p className={`text-2xl font-bold ${stat.color}`}>{typeof stat.val === 'number' ? stat.val.toLocaleString() : stat.val}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{stat.unit}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`}/>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Map className="w-4 h-4 text-slate-500"/> Distribusi Nasional (Simulasi)
                </h3>
                <div className="relative h-60 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-around overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.03]" style={{backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                    
                    {LOCATIONS.map((loc, i) => (
                      <div key={i} className="flex flex-col items-center z-10">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm bg-white ${loc.includes('BioFarma') ? 'border-blue-500 text-blue-500' : 'border-teal-500 text-teal-500'}`}>
                          {loc.includes('BioFarma') ? <Factory className="w-4 h-4"/> : <Store className="w-4 h-4"/>}
                        </div>
                        <p className="mt-2 text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-sm">{loc}</p>
                      </div>
                    ))}
                    <div className="absolute top-1/2 left-0 w-full h-px bg-slate-300 -z-0 border-t border-dashed"></div>
                </div>
              </div>
            </div>
          )}

          {/* EXPLORER */}
          {activeTab === 'explorer' && (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                 <h2 className="text-lg font-bold text-slate-800">Buku Besar Transaksi (Ledger)</h2>
                 <div className="text-xs text-slate-500">
                    Total Blok: {blockchain.length} | Antrean Offline: {localQueue.length}
                 </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="divide-y divide-slate-100">
                  {[...blockchain, ...localQueue].slice().reverse().map((block, idx) => (
                    <div key={idx} 
                        onClick={() => setSelectedBlock(block)}
                        className={`p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors ${selectedBlock?.hash === block.hash ? 'bg-teal-50/50' : ''}`}>
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                          block.data.type === 'PRESCRIPTION' ? 'bg-green-100 text-green-700' : 
                          block.data.type === 'PRODUCTION' ? 'bg-blue-100 text-blue-700' : 
                          block.data.type === 'DISPENSE' ? 'bg-purple-100 text-purple-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {block.data.type.substring(0,2)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-800">{block.data.type}</span>
                            {block.isLocal && <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">OFFLINE</span>}
                          </div>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{block.hash ? block.hash.substring(0, 40) + '...' : 'Calculating Hash...'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500 font-medium">{new Date(block.timestamp || Date.now()).toLocaleTimeString()}</p>
                        <p className="text-[10px] text-teal-600 font-bold mt-1">{block.data.drugCode}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* DETAIL BLOCK */}
              {selectedBlock && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Search className="w-4 h-4"/> Detail Teknis Blok
                  </h3>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                       <p className="text-xs font-bold text-slate-400 uppercase mb-3">Data Publik (On-Chain)</p>
                       <div className="space-y-2 text-xs font-mono text-slate-600">
                          <p>Hash: {selectedBlock.hash}</p>
                          <p>Prev: {selectedBlock.previousHash}</p>
                          <div className="h-px bg-slate-100 my-2"></div>
                          <p className="text-slate-800 font-sans font-bold">Payload:</p>
                          <p>Obat: {selectedBlock.data.drugName}</p>
                          <p>Jumlah: {selectedBlock.data.quantity}</p>
                          <p>Aktor: {selectedBlock.data.actor}</p>
                       </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-slate-200">
                       <p className="text-xs font-bold text-slate-400 uppercase mb-3">Data Privat (Off-Chain)</p>
                       {selectedBlock.data.offChainPointer ? (
                         (currentUser === 'doctor' || currentUser === 'pharmacist' || currentUser === 'developer') ? (
                           <div className="bg-green-50 p-3 rounded border border-green-100">
                              <p className="text-xs text-green-700 font-bold mb-2 flex items-center gap-1"><Lock className="w-3 h-3"/> Terdekripsi</p>
                              {offChainStorage[selectedBlock.data.offChainPointer!] ? (
                                <div className="space-y-1 text-xs text-slate-700">
                                  <p><span className="text-slate-400">Pasien:</span> {offChainStorage[selectedBlock.data.offChainPointer!].patientName}</p>
                                  <p><span className="text-slate-400">NIK:</span> {offChainStorage[selectedBlock.data.offChainPointer!].nik}</p>
                                  <p><span className="text-slate-400">Diagnosa:</span> {offChainStorage[selectedBlock.data.offChainPointer!].diagnosis}</p>
                                </div>
                              ) : <p className="text-xs text-red-500">Data tidak ditemukan di node lokal.</p>}
                           </div>
                         ) : (
                           <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                              <Lock className="w-8 h-8 mb-2 opacity-20"/>
                              <p className="text-xs">Konten Terenkripsi</p>
                           </div>
                         )
                       ) : (
                         <p className="text-xs text-slate-400 italic">Tidak ada data privat dalam transaksi ini.</p>
                       )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* INPUT FORM (Shared Style) */}
          {(activeTab === 'production' || activeTab === 'doctor') && (
             <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
               <div className="flex items-center gap-4 mb-6 border-b border-slate-100 pb-6">
                 <div className={`p-3 rounded-full ${activeTab === 'production' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                   {activeTab === 'production' ? <Factory className="w-6 h-6"/> : <Stethoscope className="w-6 h-6"/>}
                 </div>
                 <div>
                   <h2 className="text-lg font-bold text-slate-800">
                     {activeTab === 'production' ? 'Input Batch Produksi Baru' : 'Penerbitan Resep Digital'}
                   </h2>
                   <p className="text-sm text-slate-500">
                     {activeTab === 'production' ? 'Registrasi stok awal ke jaringan blockchain.' : 'Data klinis pasien akan disimpan secara terpisah (Off-Chain).'}
                   </p>
                 </div>
               </div>

               <div className="space-y-5">
                 {activeTab === 'doctor' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">NIK Pasien (SatuSehat)</label>
                        <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" 
                               value={formRx.nik} onChange={e => setFormRx({...formRx, nik: e.target.value})} placeholder="Nomor Induk Kependudukan"/>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">Nama Lengkap</label>
                        <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none" 
                               value={formRx.patientName} onChange={e => setFormRx({...formRx, patientName: e.target.value})} placeholder="Sesuai KTP"/>
                      </div>
                    </div>
                 )}

                 <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Pilih Produk Farmasi</label>
                    <div className="space-y-2">
                       {DRUG_CATALOG.map((d,i) => (
                         <div key={i} onClick={() => setFormRx({...formRx, drugIdx: i})} 
                              className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${formRx.drugIdx === i ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <span className="text-sm font-medium text-slate-700">{d.name}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded">{d.din}</span>
                         </div>
                       ))}
                    </div>
                 </div>

                 <button 
                   onClick={activeTab === 'production' ? () => mintBlock({
                     type: 'PRODUCTION',
                     id: `BATCH-${Date.now()}`,
                     drugName: DRUG_CATALOG[formRx.drugIdx].name,
                     drugCode: DRUG_CATALOG[formRx.drugIdx].din,
                     quantity: 5000,
                     actor: 'BioFarma Corp',
                     location: 'Pabrik Pusat',
                     status: 'stored',
                     timestamp: ''
                   }) : handleCreateRx}
                   className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg shadow-sm transition-colors text-sm"
                 >
                   {activeTab === 'production' ? 'GENERATE BATCH HASH' : 'ENKRIPSI & TERBITKAN RESEP'}
                 </button>
               </div>
             </div>
          )}

          {/* PHARMACY */}
          {activeTab === 'pharmacy' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
                <div className="flex items-center gap-4 mb-8">
                   <div className="p-3 bg-purple-50 text-purple-600 rounded-full"><Store className="w-6 h-6"/></div>
                   <div>
                     <h2 className="text-lg font-bold text-slate-800">Dispensing & Verifikasi</h2>
                     <p className="text-sm text-slate-500">Validasi Smart Contract untuk penyerahan obat.</p>
                   </div>
                </div>

                <div className="flex gap-3">
                  <input 
                    type="text" 
                    placeholder="Masukkan ID Resep (Scan QR / Ketik ID)..." 
                    className="flex-1 border border-slate-300 rounded-lg px-4 py-3 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    value={scanHash}
                    onChange={e => setScanHash(e.target.value)}
                  />
                  <button onClick={initSmartContractVerification} className="px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg text-sm shadow-sm">
                    VERIFIKASI
                  </button>
                </div>

                <div className="mt-8">
                   <p className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-wider">Antrean Resep Aktif (Simulasi)</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                     {blockchain.filter(b => b.data.type === 'PRESCRIPTION' && b.data.status === 'active').map(b => (
                       <div key={b.hash} onClick={() => setScanHash(b.data.id)} className="border border-slate-200 p-4 rounded-lg hover:border-purple-400 cursor-pointer transition-colors bg-slate-50 hover:bg-white flex justify-between items-center group">
                          <div>
                            <p className="text-xs font-bold text-teal-600 font-mono mb-1">{b.data.id}</p>
                            <p className="text-sm font-medium text-slate-700">{b.data.drugName}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-500"/>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL */}
        {showSmartContractModal && (
          <div className="absolute inset-0 z-50 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl shadow-2xl p-6">
                <h3 className="text-md font-bold text-slate-800 mb-6 text-center pb-4 border-b border-slate-100">
                   Eksekusi Smart Contract
                </h3>
                
                <div className="space-y-4 mb-6">
                   <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${contractStep >= 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        {contractStep >= 1 ? <CheckCircle className="w-4 h-4"/> : "1"}
                      </div>
                      <span className={`text-sm ${contractStep >= 1 ? 'text-slate-800' : 'text-slate-400'}`}>Validasi Tanda Tangan Digital</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${contractStep >= 2 ? 'bg-green-100 text-green-700' : contractStep === 4 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                        {contractStep >= 2 ? <CheckCircle className="w-4 h-4"/> : contractStep === 4 ? <XCircle className="w-4 h-4"/> : "2"}
                      </div>
                      <span className={`text-sm ${contractStep >= 2 ? 'text-slate-800' : contractStep === 4 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>Cek Double Spending</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${contractStep >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-400'}`}>
                        {contractStep >= 3 ? <Lock className="w-4 h-4"/> : "3"}
                      </div>
                      <span className={`text-sm ${contractStep >= 3 ? 'text-slate-800' : 'text-slate-400'}`}>Finalisasi Transaksi</span>
                   </div>
                </div>

                {contractStep === 3 && (
                  <button onClick={executeDispense} className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-sm shadow-md">
                    KONFIRMASI PENYERAHAN
                  </button>
                )}
                {contractStep === 4 && (
                  <button onClick={() => setShowSmartContractModal(false)} className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-sm shadow-md">
                    BATALKAN
                  </button>
                )}
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default PrismaAdvanced;
