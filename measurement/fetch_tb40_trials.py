"""Download per-trial results of Terminal-Bench 4.0 leaderboard submissions (backs docs/measurements/08_defects_and_icc_tb40.md).

Source: the public leaderboard harbor-framework/terminal-bench, leaderboard/submissions/*.json.
Each submission lists source_jobs (job ids on Harbor Hub) and the ids of its trials.
Trial results (task_name, reward, error_type) are embedded in the RSC payload of the public page
https://hub.harborframework.com/jobs/<job_id>?page=N (100 trials per page).

    python measurement/fetch_tb40_trials.py tb40_trials.csv

Uses the public GitHub REST API without authentication (60 requests/hour is enough);
set GITHUB_TOKEN to raise the limit.

Writes CSV: submission, model, agent, effort, job_id, trial_id, task, attempt, reward, error_type, status, is_scored.
Self-check: trials per job = total reported by the page; trial ids match the list in the submission;
successes match the published count.
"""
import sys, os, json, csv, time, re, base64, urllib.request

sys.stdout.reconfigure(encoding='utf-8')
REPO = 'harbor-framework/terminal-bench'
DIR = 'leaderboard/submissions'
HUB = 'https://hub.harborframework.com/jobs/{job}?page={page}'


def gh_json(path):
    headers = {'Accept': 'application/vnd.github+json', 'User-Agent': 'agent-reliability-calculator'}
    if os.environ.get('GITHUB_TOKEN'):
        headers['Authorization'] = 'Bearer ' + os.environ['GITHUB_TOKEN']
    req = urllib.request.Request('https://api.github.com/' + path, headers=headers)
    return json.loads(urllib.request.urlopen(req, timeout=60).read().decode('utf-8'))


def rsc_text(html):
    """Join self.__next_f.push([1,"..."]) chunks into one decoded text."""
    parts = []
    for m in re.finditer(r'self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)', html):
        parts.append(json.loads(m.group(1)))
    return ''.join(parts)


def trials_page(job, page):
    req = urllib.request.Request(HUB.format(job=job, page=page), headers={'User-Agent': 'agent-reliability-calculator (+public leaderboard analysis)'})
    html = urllib.request.urlopen(req, timeout=60).read().decode('utf-8')
    txt = rsc_text(html)
    i = txt.find('"initialTrials":')
    if i < 0:
        raise RuntimeError(f'no initialTrials on {job} p{page}')
    obj, _ = json.JSONDecoder().raw_decode(txt, i + len('"initialTrials":'))
    return obj


def main(out):
    files = [f['name'] for f in gh_json(f'repos/{REPO}/contents/{DIR}') if f['name'].endswith('.json')]
    rows, report = [], []
    for name in files:
        meta = gh_json(f'repos/{REPO}/contents/{DIR}/{name}')
        sub = json.loads(base64.b64decode(meta['content']).decode('utf-8'))
        src = sub['source_filter']
        want = set(sub['trials'])
        got = []
        try:
            for job in sub['source_jobs']:
                page, pages = 1, 1
                while page <= pages:
                    obj = trials_page(job, page)
                    pages = obj['total_pages']
                    for t in obj['items']:
                        got.append((job, t))
                    page += 1
                    time.sleep(1.0)
        except Exception as e:  # private job on the Hub (redirect to login -> 404): skip, but record it
            print(f'{name}: SKIP ({type(e).__name__}: {e})', flush=True)
            report.append((name, len(want), 0, False, sub['metrics'].get('successes'), None))
            continue
        got_ids = {t['id'] for _, t in got}
        ok = want <= got_ids
        for job, t in got:
            if t['id'] not in want:
                continue  # job trials that are not part of the submission (e.g. filtered out)
            rows.append({
                'submission': name, 'model': src.get('model_name'), 'agent': src.get('agent'),
                'effort': src.get('reasoning_effort'), 'job_id': job, 'trial_id': t['id'],
                'task': t['task_name'].split('/', 1)[-1], 'attempt': t.get('attempt'),
                'reward': t.get('reward'), 'error_type': t.get('error_type'),
                'status': t.get('status'), 'is_scored': t.get('is_scored'),
            })
        n_sub = sum(1 for r in rows if r['submission'] == name)
        succ = sum(1 for r in rows if r['submission'] == name and (r['reward'] or 0) >= 1)
        report.append((name, len(want), n_sub, ok, sub['metrics'].get('successes'), succ))
        print(f'{name}: trials {n_sub}/{len(want)} ids_ok={ok} successes pub={sub["metrics"].get("successes")} ours={succ}', flush=True)
    with open(out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader(); w.writerows(rows)
    bad = [r for r in report if not r[3] or r[1] != r[2] or r[4] != r[5]]
    print(f'\nwrote {len(rows)} rows; submissions with mismatches: {len(bad)}')
    for r in bad:
        print('  MISMATCH', r)


if __name__ == '__main__':
    main(sys.argv[1])
