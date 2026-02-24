#!/usr/bin/env python3
"""
Sales EQ Assignment Pipeline
─────────────────────────────
Chains Scholar → Visionary → AI Analyst → CEO
to produce a high-quality assignment JSON.

Usage:
  python3 pipeline.py --chapter 11
  python3 pipeline.py --chapter "11-12"
  python3 pipeline.py --chapter 22 --push

Options:
  --chapter   Chapter number or range (e.g. 11 or "11-12")
  --push      Automatically push to saleseqcoach.com after generation
  --book      Path to book.txt (default: ./book.txt)
  --output    Output filename (default: assignment_chXX.json)
"""

import argparse
import json
import os
import sys
import subprocess
from anthropic import Anthropic

# ── Import agent prompts ──────────────────────
from agents.scholar     import SCHOLAR_PROMPT
from agents.visionary   import VISIONARY_PROMPT
from agents.ai_analyst  import AI_ANALYST_PROMPT
from agents.ceo         import CEO_PROMPT

client = Anthropic()
MODEL  = "claude-sonnet-4-6"

def load_book(book_path):
    """Load the full book text."""
    if not os.path.exists(book_path):
        print(f"❌ Book not found at: {book_path}")
        print("   Make sure book.txt is in this folder or use --book to specify path")
        sys.exit(1)
    with open(book_path, 'r', encoding='utf-8') as f:
        return f.read()

def extract_chapter(book_text, chapter):
    """Try to extract just the relevant chapter(s) from the book."""
    # Try to find chapter markers
    chapter_str = str(chapter).replace('-', '–')
    lines = book_text.split('\n')
    
    # Look for chapter start
    start_idx = None
    end_idx   = None
    
    for i, line in enumerate(lines):
        line_lower = line.lower().strip()
        if f'chapter {chapter}' in line_lower or f'chapter {chapter_str}' in line_lower:
            if start_idx is None:
                start_idx = i
        elif start_idx is not None and line_lower.startswith('chapter '):
            end_idx = i
            break
    
    if start_idx is not None:
        chapter_lines = lines[start_idx:end_idx] if end_idx else lines[start_idx:start_idx+500]
        return '\n'.join(chapter_lines)
    
    # If we can't find it, return full book (Scholar will find what it needs)
    return book_text

def call_agent(agent_name, system_prompt, user_message, expect_json=True):
    """Call an agent and return its response."""
    import re
    print(f"\n{chr(8212)*50}")
    print(f"  {agent_name} is working...")
    print(f"{chr(8212)*50}")
    
    response = client.messages.create(
        model=MODEL,
        max_tokens=8000,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}]
    )
    
    text = response.content[0].text
    
    if expect_json:
        extracted = None
        
        # Method 1: find ```json ... ``` block
        idx = text.find("```json")
        if idx != -1:
            start = idx + 7
            end = text.find("```", start)
            if end != -1:
                extracted = text[start:end].strip()
        
        # Method 2: find ``` ... ``` block
        if not extracted:
            idx = text.find("```")
            if idx != -1:
                start = idx + 3
                end = text.find("```", start)
                if end != -1:
                    candidate = text[start:end].strip()
                    if candidate.startswith("{"):
                        extracted = candidate
        
        # Method 3: find outermost { }
        if not extracted:
            start = text.find("{")
            end = text.rfind("}")
            if start != -1 and end != -1 and end > start:
                extracted = text[start:end+1]
        
        if extracted:
            text = extracted
        
        try:
            parsed = json.loads(text)
            print(f"  ✅ {agent_name} complete")
            return parsed
        except json.JSONDecodeError as e:
            print(f"  ⚠️  {agent_name} returned invalid JSON: {e}")
            print(f"  Raw response saved for debugging")
            fname = "debug_" + agent_name.lower().replace(" ", "_") + ".txt"
            with open(fname, "w") as f:
                f.write(response.content[0].text)
            return None
    
    print(f"  ✅ {agent_name} complete")
    return text

def run_pipeline(chapter, book_path, output_file, auto_push):
    """Run the full agent pipeline."""
    
    print(f"\n🚀 Sales EQ Assignment Pipeline")
    print(f"   Chapter: {chapter}")
    print(f"   Book: {book_path}")
    print(f"   Output: {output_file}")
    
    # ── Load book ────────────────────────────────
    print(f"\n📚 Loading book...")
    book_text = load_book(book_path)
    chapter_text = extract_chapter(book_text, chapter)
    print(f"   Book loaded ({len(book_text):,} chars)")
    
    # ── AGENT 1: Scholar ─────────────────────────
    scholar_input = f"""
Please analyze Chapter {chapter} from Sales EQ by Jeb Blount.

Here is the relevant chapter content:

{chapter_text}

If the chapter content above seems incomplete, also reference your knowledge of 
the full book context provided at the start of this conversation.

Produce your structured JSON analysis.
"""
    
    scholar_output = call_agent(
        "Scholar",
        SCHOLAR_PROMPT + f"\n\nFull book for reference:\n{book_text[:8000]}",
        scholar_input
    )
    
    if not scholar_output:
        print("❌ Scholar failed. Check debug_scholar.txt")
        sys.exit(1)
    
    print(f"\n  Scholar found: {len(scholar_output.get('keyFrameworks', []))} frameworks, "
          f"{len(scholar_output.get('coreSkills', []))} core skills, "
          f"{len(scholar_output.get('quizFodder', []))} quiz concepts")
    
    # ── AGENT 2: Visionary ───────────────────────
    visionary_input = f"""
Using the Scholar's analysis below, design a compelling Part 2 scenario 
for this chapter's assignment.

SCHOLAR'S ANALYSIS:
{json.dumps(scholar_output, indent=2)}

Create a scenario that REQUIRES the chapter's core skills to succeed.
"""
    
    visionary_output = call_agent(
        "Visionary",
        VISIONARY_PROMPT,
        visionary_input
    )
    
    if not visionary_output:
        print("❌ Visionary failed. Check debug_visionary.txt")
        sys.exit(1)
    
    print(f"\n  Visionary created: '{visionary_output.get('scenarioTitle', 'scenario')}'")
    
    # ── AGENT 3: AI Analyst ──────────────────────
    analyst_input = f"""
Review this Part 2 scenario for Chapter {chapter}.

SCHOLAR'S CHAPTER ANALYSIS:
{json.dumps(scholar_output, indent=2)}

VISIONARY'S SCENARIO:
{json.dumps(visionary_output, indent=2)}

Run your cheat test and development test. Approve or revise.
"""
    
    analyst_output = call_agent(
        "AI Analyst",
        AI_ANALYST_PROMPT,
        analyst_input
    )
    
    if not analyst_output:
        print("❌ AI Analyst failed. Check debug_ai_analyst.txt")
        sys.exit(1)
    
    verdict = analyst_output.get('verdict', 'UNKNOWN')
    print(f"\n  AI Analyst verdict: {verdict}")
    
    # Get the final scenario (approved or revised)
    if verdict == 'APPROVED':
        final_scenario = analyst_output.get('approvedScenario', visionary_output)
    else:
        final_scenario = analyst_output.get('revisedScenario', visionary_output)
        print(f"  Scenario was revised for quality")
    
    # ── AGENT 4: CEO ─────────────────────────────
    ceo_input = f"""
Produce the final complete assignment JSON for Chapter {chapter}.

SCHOLAR'S ANALYSIS (use for quiz questions):
{json.dumps(scholar_output, indent=2)}

APPROVED SCENARIO (use for Part 2):
{json.dumps(final_scenario, indent=2)}

AI ANALYST NOTES:
{json.dumps(analyst_output, indent=2)}

Build the complete assignment. Write all quiz questions from scratch using 
the Scholar's quizFodder and keyFrameworks. Ensure Part 1 and Part 2 are cohesive.
Output ONLY the final JSON.
"""
    
    final_assignment = call_agent(
        "CEO",
        CEO_PROMPT,
        ceo_input
    )
    
    if not final_assignment:
        print("❌ CEO failed. Check debug_ceo.txt")
        sys.exit(1)
    
    # ── Save output ──────────────────────────────
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_assignment, f, indent=2, ensure_ascii=False)
    
    print(f"\n{'═'*50}")
    print(f"  ✅ Assignment complete!")
    print(f"  Title: {final_assignment.get('title', 'N/A')}")
    print(f"  Slug:  /{final_assignment.get('slug', 'N/A')}")
    print(f"  Quiz:  {len(final_assignment.get('p1', {}).get('questions', []))} questions")
    print(f"  Saved: {output_file}")
    print(f"{'═'*50}\n")
    
    # ── Auto push ────────────────────────────────
    if auto_push:
        admin_key = os.environ.get('SALESEQ_ADMIN_KEY', '')
        if not admin_key:
            print("⚠️  SALESEQ_ADMIN_KEY not set — skipping push")
            print(f"   To push manually: node push-assignment.js {output_file}")
        else:
            print("📤 Pushing to saleseqcoach.com...")
            result = subprocess.run(
                ['node', 'push-assignment.js', output_file],
                capture_output=True, text=True,
                env={**os.environ, 'SALESEQ_ADMIN_KEY': admin_key}
            )
            if result.returncode == 0:
                print(result.stdout)
            else:
                print(f"❌ Push failed: {result.stderr}")
                print(f"   Try manually: node push-assignment.js {output_file}")
    else:
        print(f"📤 To push to dashboard:")
        print(f"   node push-assignment.js {output_file}\n")
    
    return final_assignment


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Generate a Sales EQ assignment')
    parser.add_argument('--chapter', required=True, help='Chapter number or range (e.g. 11 or 11-12)')
    parser.add_argument('--book',    default='book.txt', help='Path to book.txt')
    parser.add_argument('--output',  default=None, help='Output JSON filename')
    parser.add_argument('--push',    action='store_true', help='Auto-push to saleseqcoach.com')
    
    args = parser.parse_args()
    
    # Auto-generate output filename
    if not args.output:
        ch = str(args.chapter).replace(' ', '_').replace('-', '_')
        args.output = f"assignment_ch{ch}.json"
    
    run_pipeline(
        chapter=args.chapter,
        book_path=args.book,
        output_file=args.output,
        auto_push=args.push
    )
