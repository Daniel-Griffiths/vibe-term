import { Button } from "./button";

interface IFormConfirmationProps {
  onSubmit: () => void;
  onCancel: () => void;
  data: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  };
}

export function FormConfirmation({
  data,
  onSubmit,
  onCancel,
}: IFormConfirmationProps) {
  const { message, confirmText = "Delete", cancelText = "Cancel" } = data;

  return (
    <div className="space-y-4">
      <p className="text-gray-300">{message}</p>
      <div className="flex gap-3 justify-end pt-4">
        <Button onClick={onCancel} variant="outline">
          {cancelText}
        </Button>
        <Button onClick={onSubmit} variant="danger">
          {confirmText}
        </Button>
      </div>
    </div>
  );
}
