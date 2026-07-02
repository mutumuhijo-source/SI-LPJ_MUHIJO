import { OperationType, FirestoreErrorInfo } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errorMessage.includes("Quota limit exceeded") || errorMessage.includes("Quota exceeded");

  let displayError = errorMessage;
  if (isQuotaError) {
    displayError = `🔴 LIMIT KUOTA DATABASE TERCAPAI (50,000 reads/day free tier). \n\nSistem pelaporan sedang non-aktif sementara karena batas penggunaan gratis harian Firestore telah penuh. \n\nReset Otomatis: Besok pukul 14:00 WIB (00:00 PST). \n\nSolusi: Pemilik dapat meningkatkan limit ke paket Pay-as-you-go di: https://console.firebase.google.com/u/0/project/${firebaseConfig.projectId}/usage`;
  }

  const errInfo: FirestoreErrorInfo = {
    error: displayError,
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
    },
    operationType,
    path
  };
  
  if (isQuotaError) {
    console.warn('Firestore Error (Quota Exceeded): ', JSON.stringify(errInfo));
  } else {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  
  // Safe warn inside iframe sandboxes
  try {
    const userFriendlyMsg = isQuotaError 
      ? displayError 
      : `Gagal melakukan operasi ${operationType} pada ${path || 'database'}. Silakan cek koneksi internet Anda atau coba lagi nanti.`;
    
    // Attempt standard alert if available, ignore fallback blocks
    if (typeof window !== 'undefined' && window.alert) {
      window.alert(userFriendlyMsg);
    }
  } catch (e) {
    console.warn("Could not display alert in iframe environment:", e);
  }
}

