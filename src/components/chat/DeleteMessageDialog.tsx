
"use client";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { DeleteType } from '@/types';

interface DeleteMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (deleteType: DeleteType) => void;
  isCurrentUser: boolean;
}

export default function DeleteMessageDialog({
  isOpen,
  onClose,
  onConfirm,
  isCurrentUser,
}: DeleteMessageDialogProps) {
  if (!isOpen) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Message?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-col sm:space-x-0 gap-2">
            {isCurrentUser && (
                 <Button
                    variant="destructive"
                    onClick={() => onConfirm('everyone')}
                    className="w-full"
                >
                    Delete for Everyone
                </Button>
            )}
            <Button
                variant="outline"
                onClick={() => onConfirm('me')}
                className="w-full"
            >
                Delete for Me
            </Button>
             <Button
                variant="ghost"
                onClick={onClose}
                className="w-full mt-2"
            >
                Cancel
            </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
