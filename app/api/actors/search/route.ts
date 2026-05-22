import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execPromise = util.promisify(exec);

// Absolute binary path definitions
const PYTHON_PATH = '"C:\\Users\\Casey Wheeler\\AppData\\Local\\Python\\pythoncore-3.14-64\\python.exe"';
const HOLEHE_PATH = '"C:\\Users\\Casey Wheeler\\AppData\\Local\\Python\\pythoncore-3.14-64\\Scripts\\holehe.exe"';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const query = searchParams.get('query');

  if (!type || !query) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  
  // Clean basic input characters while leaving common markers
  const sanitizedQuery = query.replace(/[^a-zA-Z0-9_\-\.\+@\s]/g, '').trim();

  try {
    // ==========================================
    // VECTOR 1: USERNAME (MAIGRET FOOTPRINTS)
    // ==========================================
    if (type === 'username') {
      const command = `${PYTHON_PATH} -m maigret ${sanitizedQuery} --tags social --timeout 20 --no-color --no-progressbar`;
      const { stdout } = await execPromise(command, { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
      const results = stdout.split('\n')
        .filter(line => line.includes('http'))
        .map(line => {
            const urlMatch = line.match(/(https?:\/\/\S+)/);
            return urlMatch ? { platform: line.replace(urlMatch[0], '').trim(), url: urlMatch[0] } : null;
        }).filter(Boolean);
      return NextResponse.json({ engine: 'MAIGRET_CORE // ACTIVE', results });
    }

    // ==========================================
    // VECTOR 2: EMAIL (HOLEHE footprint mapping)
    // ==========================================
    if (type === 'email') {
      const command = `${HOLEHE_PATH} ${sanitizedQuery} --only-used --no-color`;
      const { stdout } = await execPromise(command);
      
      const emailDorks = [
        { platform: 'Google Target Query', url: `https://www.google.com/search?q=%22${sanitizedQuery}%22` },
        { platform: 'LinkedIn Profile Lookup', url: `https://www.linkedin.com/search/results/all/?keywords=${sanitizedQuery}` },
        { platform: 'Facebook Directory Find', url: `https://www.facebook.com/search/top/?q=${sanitizedQuery}` }
      ];

      const results = stdout.split('\n')
        .filter(line => line.includes('[+]')) 
        .map(line => ({ platform: line.replace('[+]', '').trim(), url: '#' }));

      return NextResponse.json({ 
        engine: 'E-HARVESTER // ACTIVE', 
        results: [...results, ...emailDorks] 
      });
    }

    // ==========================================
    // VECTOR 3: PHONE (FIXED VIA TEMP FILE)
    // ==========================================
    if (type === 'phone') {
        const numericPhone = sanitizedQuery.replace(/[^0-9]/g, '');
        
        // Formulate a proper multi-line python string
        const pyScriptContent = [
          "import phonenumbers",
          "from phonenumbers import geocoder, carrier",
          "import sys",
          "try:",
          `    n = phonenumbers.parse('+${numericPhone}')`,
          "    if phonenumbers.is_valid_number(n):",
          "        loc = geocoder.description_for_number(n, 'en')",
          "        prov = carrier.name_for_number(n, 'en')",
          "        print('Status: Valid Number Mapping')",
          "        print('Region: ' + str(phonenumbers.region_code_for_number(n)))",
          "        print('Location Context: ' + (loc if loc else 'Unknown Region'))",
          "        print('Carrier Profile: ' + (prov if prov else 'Unknown Telco Network'))",
          "    else:",
          "        print('Status: Mathematically Invalid Structure')",
          "except Exception as e:",
          "    print('Status: Parser Exception Handled')"
        ].join('\n');

        // Write content to a safe, temporary execution file to bypass command shell escaping bugs
        const tempPath = path.join(os.tmpdir(), `phone_lookup_${Date.now()}.py`);
        fs.writeFileSync(tempPath, pyScriptContent, 'utf-8');

        let stdout = '';
        try {
          const res = await execPromise(`${PYTHON_PATH} "${tempPath}"`);
          stdout = res.stdout;
        } finally {
          // Cleanup the file immediately following execution
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        }
        
        const metadataResults = stdout.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => ({ platform: line.trim(), url: '#' }));
        
        const investigationLinks = [
            { platform: 'Google Global Dork', url: `https://www.google.com/search?q=%22${sanitizedQuery}%22` },
            { platform: 'TrueCaller Web Registry', url: `https://www.truecaller.com/search/us/${numericPhone}` }
        ];

        return NextResponse.json({ 
            engine: 'TELCO_INTELLIGENCE // DETAILED', 
            results: [...metadataResults, ...investigationLinks] 
        });
    }

    // ==========================================
    // VECTOR 4: DORK (FILETYPE & SOURCE ANALYSIS)
    // ==========================================
    if (type === 'dork') {
        const results = [
            { platform: 'Exposed Documentation Search (PDF/DOC)', url: `https://www.google.com/search?q=filetype:pdf+OR+filetype:doc+%22${encodeURIComponent(sanitizedQuery)}%22` },
            { platform: 'Academic & Institutional Records (.EDU/.GOV)', url: `https://www.google.com/search?q=%22${encodeURIComponent(sanitizedQuery)}%22+site:gov+OR+site:edu` },
            { platform: 'Social Profile Indexing Footprint', url: `https://www.google.com/search?q=site:instagram.com+OR+site:facebook.com+OR+site:linkedin.com+%22${encodeURIComponent(sanitizedQuery)}%22` }
        ];
        return NextResponse.json({ engine: 'DORK_ENGINE // ACTIVE', results });
    }

    // ==========================================
    // VECTOR 5: BREACH (TARGETED RECONNAISSANCE)
    // ==========================================
    if (type === 'breach') {
        const results = [
            { platform: 'Pastebin Indexed Aggregators', url: `https://www.google.com/search?q=site:pastebin.com+%22${encodeURIComponent(sanitizedQuery)}%22` },
            { platform: 'GitHub Hardcoded Leaks & Repositories', url: `https://github.com/search?q=%22${encodeURIComponent(sanitizedQuery)}%22&type=code` },
            { platform: 'Breach Forums Keyword Scanning Index', url: `https://www.google.com/search?q=site:breachforums.cx+%22${encodeURIComponent(sanitizedQuery)}%22` }
        ];
        return NextResponse.json({ engine: 'BREACH_SCANNER // ACTIVE', results });
    }

    return NextResponse.json({ engine: 'STANDBY', results: [] });

  } catch (error: any) {
    console.error("CRITICAL_EXEC_ERROR:", error);
    return NextResponse.json({ 
        engine: 'EXECUTION_ERROR', 
        results: [{ platform: `Error: ${error.message || 'Check logs'}`, url: '' }] 
    }, { status: 500 });
  }
}