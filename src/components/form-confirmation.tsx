import { Button } from "./button";

interface IFormConfirmationProps {
  data: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
  };
  onSubmit: () => void;
  onCancel: () => void;
}

export default function FormConfirmation({
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
