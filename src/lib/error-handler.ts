import { OperationType, FirestoreErrorInfo } from '../types';

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const isQuotaError = errorMessage.includes("Quota limit exceeded") || errorMessage.includes("Quota exceeded");

  let displayError = errorMessage;
  if (isQuotaError) {
    displayError = `🔴 LIMIT KUOTA DATABASE TERCAPAI (50,000 reads/day free tier). \n\nSistem pelaporan sedang non-aktif sementara karena batas penggunaan gratis harian Firestore telah penuh. \n\nReset Otomatis: Besok pukul 14:00 WIB (00:00 PST). \n\nSolusi: Pemilik dapat meningkatkan limit ke paket Pay-as-you-go di: https://console.firebase.google.com/u/0/project/smooth-multiplexer-v8gvj/usage`;
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
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (isQuotaError) {
    // If it's a quota error, we might want to alert the user specifically if we can
    // but at minimum we must throw so the app knows fetching failed.
    const customError = new Error(JSON.stringify(errInfo));
    // @ts-ignore
    customError.isQuotaError = true;
    throw customError;
  }

  throw new Error(JSON.stringify(errInfo));
}
