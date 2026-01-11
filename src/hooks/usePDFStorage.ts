import { useState, useCallback } from 'react';
import type { RecentFile } from '@/types';
import { saveFileToDB, getFileFromDB, deleteFileFromDB } from '@/utils/pdfStorage';
import { Logger } from '@/utils/logger';

// 최근 파일 목록 관리 전용 훅
const useRecentFilesList = () => {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  const loadRecentFiles = useCallback(async (): Promise<void> => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(['recentFiles']);
        const files: RecentFile[] = (result.recentFiles as RecentFile[]) || [];
        setRecentFiles(files);
      } catch (error) {
        Logger.error('Failed to load recent files:', error);
      }
    }
  }, []);

  const addRecentFile = useCallback((newFile: RecentFile) => {
    setRecentFiles(prev => {
      const files = [newFile, ...prev.filter(f => f.id !== newFile.id)];
      return files.slice(0, 5);
    });
  }, []);

  const removeRecentFile = useCallback((fileId: string) => {
    setRecentFiles(prev => prev.filter(f => f.id !== fileId));
  }, []);

  const updateRecentFile = useCallback((updatedFile: RecentFile) => {
    setRecentFiles(prev => {
      const otherFiles = prev.filter(f => f.id !== updatedFile.id);
      return [updatedFile, ...otherFiles];
    });
  }, []);

  return {
    recentFiles,
    actions: {
      loadRecentFiles,
      addRecentFile,
      removeRecentFile,
      updateRecentFile
    }
  };
};

// 파일 데이터 CRUD 전용 훅
const useFileDataCRUD = () => {
  const saveFile = useCallback(async (fileId: string, file: File | string | Blob): Promise<void> => {
    try {
      if (typeof file === "string") throw new Error("Cannot save string as file data");
      await saveFileToDB(fileId, file);
    } catch (error) {
      Logger.error('Failed to save file to IndexedDB:', error);
      throw error;
    }
  }, []);

  const getFile = useCallback(async (fileId: string): Promise<File | string | Blob | null> => {
    try {
      return await getFileFromDB(fileId);
    } catch (error) {
      Logger.error('Failed to get file from IndexedDB:', error);
      return null;
    }
  }, []);

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    try {
      await deleteFileFromDB(fileId);
    } catch (error) {
      Logger.error('Failed to delete file from IndexedDB:', error);
      throw error;
    }
  }, []);

  return {
    actions: {
      saveFile,
      getFile,
      deleteFile
    }
  };
};

import { formatFileSize, formatDate } from '@/utils/formatters';

// 데이터 포맷팅 전용 훅 (순수 함수)
const useDataFormatting = () => {

  return {
    formatFileSize,
    formatDate
  };
};

// 메인 훅 - 세 가지 책임을 조합
export const usePDFStorage = () => {
  const recentFiles = useRecentFilesList();
  const fileCRUD = useFileDataCRUD();
  const formatting = useDataFormatting();

  const saveRecentFile = useCallback(async (file: File | string | Blob, pageNumber: number): Promise<void> => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        let fileName: string;
        let fileSize: number;

        if (typeof file === 'string') {
          return;
        } else if (file instanceof File) {
          fileName = file.name;
          fileSize = file.size;
        } else {
          return;
        }

        const result = await chrome.storage.local.get(['recentFiles']);
        const currentFiles = (result.recentFiles as RecentFile[]) || [];

        const existingIndex = currentFiles.findIndex(f => f.name === fileName);
        let fileId = existingIndex !== -1 ? currentFiles[existingIndex].id : Date.now().toString() + Math.random().toString(36).substr(2, 9);

        if (existingIndex !== -1) {
          currentFiles.splice(existingIndex, 1);
        }

        await fileCRUD.actions.saveFile(fileId, file);

        const recentFile: RecentFile = {
          id: fileId,
          name: fileName,
          lastPage: pageNumber,
          lastAccessed: Date.now(),
          size: fileSize,
        };

        recentFiles.actions.addRecentFile(recentFile);

        const newFilesForStorage = [recentFile, ...currentFiles].slice(0, 5);
        await chrome.storage.local.set({ recentFiles: newFilesForStorage });

      } catch (error) {
        Logger.error('Failed to save recent file:', error);
      }
    }
  }, [recentFiles.actions.addRecentFile, fileCRUD.actions.saveFile]);

  const openRecentFile = useCallback(async (recentFile: RecentFile): Promise<File | string | Blob | null> => {
    try {
      Logger.debug('Opening recent file:', recentFile.name);

      let fileBlob = await fileCRUD.actions.getFile(recentFile.id);

      if (fileBlob) {
        const updatedRecentFile = { ...recentFile, lastAccessed: Date.now() };
        recentFiles.actions.updateRecentFile(updatedRecentFile);

        const result = await chrome.storage.local.get(['recentFiles']);
        const files = (result.recentFiles as RecentFile[]) || [];
        const otherFiles = files.filter(f => f.id !== recentFile.id);
        const newFilesForStorage = [updatedRecentFile, ...otherFiles];

        await chrome.storage.local.set({ recentFiles: newFilesForStorage });

        return fileBlob;
      } else if (recentFile.dataUrl) {
        Logger.debug('Loaded from legacy dataUrl');
        return recentFile.dataUrl;
      } else {
        Logger.error('파일 내용을 찾을 수 없습니다. 다시 열어주세요.');
        await recentFiles.actions.removeRecentFile(recentFile.id);
        return null;
      }
    } catch (error) {
      Logger.error(`파일을 열 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
      return null;
    }
  }, [recentFiles.actions.updateRecentFile, fileCRUD.actions.getFile, recentFiles.actions.removeRecentFile]);

  const removeRecentFile = useCallback(async (fileId: string): Promise<void> => {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        await fileCRUD.actions.deleteFile(fileId);
        recentFiles.actions.removeRecentFile(fileId);

        const result = await chrome.storage.local.get(['recentFiles']);
        const files = (result.recentFiles as RecentFile[]) || [];
        const newFilesForStorage = files.filter(f => f.id !== fileId);

        await chrome.storage.local.set({ recentFiles: newFilesForStorage });
      } catch (error) {
        Logger.error('Failed to remove recent file:', error);
      }
    }
  }, [recentFiles.actions.removeRecentFile, fileCRUD.actions.deleteFile]);

  const updateLastPage = useCallback(async (file: File | string | Blob | null, pageNumber: number): Promise<void> => {
    if (file && typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      try {
        const result = await chrome.storage.local.get(['recentFiles']);
        const files: RecentFile[] = (result.recentFiles as RecentFile[]) || [];
        const fileName = file instanceof File ? file.name : undefined;

        if (fileName) {
          const fileIndex = files.findIndex(f => f.name === fileName);
          if (fileIndex !== -1) {
            const currentFile = files[fileIndex];
            const updatedFile = { ...currentFile, lastPage: pageNumber, lastAccessed: Date.now() };

            files.splice(fileIndex, 1);
            const newFilesForStorage = [updatedFile, ...files];

            recentFiles.actions.updateRecentFile(updatedFile);
            await chrome.storage.local.set({ recentFiles: newFilesForStorage });
          }
        }
      } catch (error) {
        Logger.error('Failed to update last page:', error);
      }
    }
  }, [recentFiles.actions.updateRecentFile]);

  return {
    recentFiles: recentFiles.recentFiles,
    loadRecentFiles: recentFiles.actions.loadRecentFiles,
    saveRecentFile,
    removeRecentFile,
    openRecentFile,
    updateLastPage,
    formatFileSize: formatting.formatFileSize,
    formatDate: formatting.formatDate
  };
};