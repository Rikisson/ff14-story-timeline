import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { Auth, getAuth } from 'firebase/auth';
import { Firestore, initializeFirestore } from 'firebase/firestore';
import { FirebaseStorage, getStorage } from 'firebase/storage';
import { firebaseConfig } from '../firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseService {
  readonly app = initializeApp(firebaseConfig);

  private _auth?: Auth;
  private _firestore?: Firestore;
  private _storage?: FirebaseStorage;

  get auth(): Auth {
    return (this._auth ??= getAuth(this.app));
  }

  get firestore(): Firestore {
    return (this._firestore ??= initializeFirestore(this.app, {
      ignoreUndefinedProperties: true,
    }));
  }

  get storage(): FirebaseStorage {
    return (this._storage ??= getStorage(this.app));
  }
}
