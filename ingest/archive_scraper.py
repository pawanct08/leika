"""
L.E.I.K.A. — Internet Scale Ingestion script
Created by Pawan (@pawanct08)

This pipeline scrapes massive articles (Wikipedia / Archive.org defaults),
extracts semantic concepts using basic NLP, embeds the paragraphs using SentencesTransformers,
and pipelines them into Leika's cloud Graph (Neo4j) and Vector DB (Pinecone).
"""

import os
import requests
from bs4 import BeautifulSoup
from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import pinecone

# Configuration
NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASS = os.getenv("NEO4J_PASS", "leika")
PINECONE_API = os.getenv("PINECONE_API_KEY", "dummy_key")

TARGET_URLS = [
    "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "https://en.wikipedia.org/wiki/Consciousness",
    "https://en.wikipedia.org/wiki/Ethics_of_artificial_intelligence"
]

print("🧠 Booting Neural Pipeline Models...")
# Uses local embedding model to avoid API costs during extreme internet scale ingestion
encoder = SentenceTransformer('all-MiniLM-L6-v2') 

class LeikaIngestor:
    def __init__(self):
        self.driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASS))
        pinecone.init(api_key=PINECONE_API, environment="gcp-us-west1")
        self.pinecone_idx = pinecone.Index("leika-internet-archive")
        
    def close(self):
        self.driver.close()

    def scrape_text(self, url):
        print(f"🌐 Scraping {url}...")
        resp = requests.get(url)
        soup = BeautifulSoup(resp.text, 'html.parser')
        paragraphs = [p.text.strip() for p in soup.find_all('p') if len(p.text.strip()) > 50]
        return paragraphs

    def extract_nodes_mock(self, text):
        stop_words = {"this","that","the","and","or","is","are","was","were","it","to","in","a"}
        words = [w.strip(".,()!\"'").lower() for w in text.split(" ")]
        concepts = [w for w in words if w not in stop_words and len(w) > 4]
        return list(set(concepts))[:5] # Mock NLP extraction for core concepts

    def ingest_to_graph(self, concepts, text_id):
        def _insert(tx, c1, c2, excerpt):
            # Create nodes and Hebbian edges
            tx.run('''
                MERGE (a:Concept {id: $c1})
                MERGE (b:Concept {id: $c2})
                MERGE (a)-[r:ASSOCIATED]-(b)
                ON CREATE SET r.weight = 0.2, r.excerpt = $excerpt
                ON MATCH SET r.weight = r.weight + 0.05
            ''', c1=c1, c2=c2, excerpt=excerpt)

        session = self.driver.session()
        for i in range(len(concepts)):
            for j in range(i+1, len(concepts)):
                session.execute_write(_insert, concepts[i], concepts[j], text_id)
        session.close()

    def pipeline(self, urls):
        for url in urls:
            paragraphs = self.scrape_text(url)
            print(f"📥 Found {len(paragraphs)} concepts blocks. Embedding...")
            
            for i, p_text in enumerate(tqdm(paragraphs)):
                # 1. Embed Vector for semantic search
                vector = encoder.encode(p_text).tolist()
                p_id = f"wiki_{url.split('/')[-1]}_{i}"
                
                # In production, uncomment to push to pinecone
                # self.pinecone_idx.upsert([(p_id, vector, {"text": p_text})])
                
                # 2. Extract concepts for Neural Schema
                concepts = self.extract_nodes_mock(p_text)
                
                # 3. Create Hebbian edges in Graph DB
                self.ingest_to_graph(concepts, p_id)
                
        print("✅ Ingestion complete. Leika's cloud mind expanded.")

if __name__ == "__main__":
    try:
        print("🚀 Starting L.E.I.K.A. Hyperscale Ingestion")
        ingestor = LeikaIngestor()
        # In a real scenario, this wouldn't just be TARGET_URLS,
        # but a stream of WARC files from the Internet Archive.
        ingestor.pipeline(TARGET_URLS)
    except Exception as e:
        print("Connection failed: Start Neo4j/Pinecone first or check passwords.", e)
