import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from gpt import LeikaGPT

"""
L.E.I.K.A. - Indigenous Core Training Loop
Used to train the from-scratch PyTorch transformer on local text files.
Ensure you have 'torch' installed.
"""

class SimpleTextDataset(Dataset):
    def __init__(self, text, block_size):
        # A very minimal character-level tokenizer for demonstration
        chars = sorted(list(set(text)))
        self.stoi = { ch:i for i,ch in enumerate(chars) }
        self.itos = { i:ch for i,ch in enumerate(chars) }
        self.vocab_size = len(chars)

        # encode dataset
        self.data = [self.stoi[c] for c in text]
        self.block_size = block_size

    def __len__(self):
        return len(self.data) - self.block_size - 1

    def __getitem__(self, i):
        chunk = self.data[i:i + self.block_size + 1]
        x = torch.tensor(chunk[:-1], dtype=torch.long)
        y = torch.tensor(chunk[1:], dtype=torch.long)
        return x, y

def train_leika_core(text_file_path="leika_training_data.txt"):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Initializing Leika Core on {device}...")

    # Load data
    try:
        with open(text_file_path, 'r', encoding='utf-8') as f:
            text = f.read()
    except FileNotFoundError:
        print(f"Error: {text_file_path} not found. Please provide a text corpus to train Leika on.")
        return

    block_size = 128 # keep small for local CPU testing
    dataset = SimpleTextDataset(text, block_size)
    dataloader = DataLoader(dataset, batch_size=32, shuffle=True)

    # Initialize Model (Small scale)
    model = LeikaGPT(
        vocab_size=dataset.vocab_size,
        context_length=block_size,
        d_model=256,
        num_layers=4,
        num_heads=4,
        dropout=0.1
    ).to(device)

    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3)
    epochs = 10

    print(f"Starting training loop ({epochs} epochs)...")
    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for x, y in dataloader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad(set_to_none=True)
            
            logits, loss = model(x, targets=y)
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            
        print(f"Epoch {epoch+1}/{epochs} - Loss: {total_loss/len(dataloader):.4f}")

    print("Training complete. Preserving neural weights...")
    torch.save(model.state_dict(), "leika_core_weights.pth")
    print("Saved to leika_core_weights.pth")

if __name__ == "__main__":
    train_leika_core()
