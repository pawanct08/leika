import torch
import torch.nn as nn
from torch.nn import functional as F

"""
L.E.I.K.A. - Indigenous Intelligence Core (GPT Architecture)
Built from scratch following the architecture from 'LLMs-from-scratch'.
This replaces external APIs, giving her a sovereign neural engine.
"""

class CausalSelfAttention(nn.Module):
    def __init__(self, d_model, num_heads, context_length, dropout):
        super().__init__()
        assert d_model % num_heads == 0
        self.d_model = d_model
        self.num_heads = num_heads
        self.head_dim = d_model // num_heads

        self.W_q = nn.Linear(d_model, d_model, bias=False)
        self.W_k = nn.Linear(d_model, d_model, bias=False)
        self.W_v = nn.Linear(d_model, d_model, bias=False)
        self.out_proj = nn.Linear(d_model, d_model)
        
        self.attn_dropout = nn.Dropout(dropout)
        self.resid_dropout = nn.Dropout(dropout)
        
        # Lower triangular mask to ensure causality
        self.register_buffer("mask", torch.tril(torch.ones(context_length, context_length)))

    def forward(self, x):
        B, T, C = x.size() # Batch, Time, Channels(d_model)
        
        q = self.W_q(x).view(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.W_k(x).view(B, T, self.num_heads, self.head_dim).transpose(1, 2)
        v = self.W_v(x).view(B, T, self.num_heads, self.head_dim).transpose(1, 2)

        # Scaled dot-product attention
        att = (q @ k.transpose(-2, -1)) * (1.0 / (k.size(-1) ** 0.5))
        att = att.masked_fill(self.mask[:T, :T] == 0, float('-inf'))
        att = F.softmax(att, dim=-1)
        att = self.attn_dropout(att)

        y = att @ v # (B, num_heads, T, T) x (B, num_heads, T, head_dim) -> (B, num_heads, T, head_dim)
        y = y.transpose(1, 2).contiguous().view(B, T, C)
        
        out = self.out_proj(y)
        return self.resid_dropout(out)


class FeedForward(nn.Module):
    def __init__(self, d_model, dropout=0.1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, d_model * 4),
            nn.GELU(),
            nn.Linear(d_model * 4, d_model),
            nn.Dropout(dropout)
        )

    def forward(self, x):
        return self.net(x)


class TransformerBlock(nn.Module):
    def __init__(self, d_model, num_heads, context_length, dropout):
        super().__init__()
        self.ln_1 = nn.LayerNorm(d_model)
        self.attn = CausalSelfAttention(d_model, num_heads, context_length, dropout)
        self.ln_2 = nn.LayerNorm(d_model)
        self.ffn = FeedForward(d_model, dropout)

    def forward(self, x):
        # x + attention(LayerNorm(x))
        x = x + self.attn(self.ln_1(x))
        # x + ffn(LayerNorm(x))
        x = x + self.ffn(self.ln_2(x))
        return x


class LeikaGPT(nn.Module):
    def __init__(self, vocab_size=50257, context_length=1024, d_model=768, num_layers=12, num_heads=12, dropout=0.1):
        """
        Default params match a small GPT-2 configuration.
        """
        super().__init__()
        self.context_length = context_length
        self.tok_emb = nn.Embedding(vocab_size, d_model)
        self.pos_emb = nn.Embedding(context_length, d_model)
        self.drop = nn.Dropout(dropout)
        
        self.blocks = nn.Sequential(
            *[TransformerBlock(d_model, num_heads, context_length, dropout) for _ in range(num_layers)]
        )
        
        self.ln_f = nn.LayerNorm(d_model)
        self.lm_head = nn.Linear(d_model, vocab_size, bias=False)

    def forward(self, idx, targets=None):
        B, T = idx.size()
        assert T <= self.context_length, f"Cannot forward sequence of length {T}, block size is {self.context_length}"

        pos = torch.arange(0, T, dtype=torch.long, device=idx.device)
        
        x = self.tok_emb(idx) + self.pos_emb(pos)
        x = self.drop(x)
        x = self.blocks(x)
        x = self.ln_f(x)
        logits = self.lm_head(x)

        loss = None
        if targets is not None:
            B, T, C = logits.shape
            logits_reshaped = logits.view(B * T, C)
            targets_reshaped = targets.view(B * T)
            loss = F.cross_entropy(logits_reshaped, targets_reshaped)

        return logits, loss

    @torch.no_grad()
    def generate(self, idx, max_new_tokens, temperature=1.0, top_k=None):
        """
        Autoregressive generation
        """
        for _ in range(max_new_tokens):
            idx_cond = idx if idx.size(1) <= self.context_length else idx[:, -self.context_length:]
            logits, _ = self(idx_cond)
            logits = logits[:, -1, :] # focus only on the last time step
            
            if top_k is not None:
                v, _ = torch.topk(logits, top_k)
                logits[logits < v[:, [-1]]] = -float('Inf')
                
            probs = F.softmax(logits / temperature, dim=-1)
            idx_next = torch.multinomial(probs, num_samples=1)
            idx = torch.cat((idx, idx_next), dim=1)
            
        return idx
