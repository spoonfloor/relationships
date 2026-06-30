import { alert as showAlert } from "./modal.js";

export function createPuzzleUploader(onPuzzleUploaded) {
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json';
  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const puzzle = JSON.parse(e.target.result);
        onPuzzleUploaded(puzzle);
      } catch (err) {
        console.error('Error parsing puzzle file:', err);
        showAlert({ title: "Error", message: `Error parsing puzzle file: ${err.message}` });
      }
    };
    reader.readAsText(file);
  });
  return fileInput;
}
