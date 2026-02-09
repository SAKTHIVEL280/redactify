/**
 * PII Detection Engine - Phase 1
 * Client-side only, regex-based detection with zero server calls
 * Detects: emails, phones, URLs, names, addresses, locations
 */

import DOMPurify from 'dompurify';
import { getFileSizeLimits } from './browserCompat';

export const PII_TYPES = {
  EMAIL: 'email',
  PHONE: 'phone',
  URL: 'url',
  NAME: 'name',
  ADDRESS: 'address',
  SSN: 'ssn',
  CREDIT_CARD: 'credit_card',
  DATE_OF_BIRTH: 'dob',
  PASSPORT: 'passport',
  IP_ADDRESS: 'ip',
  BANK_ACCOUNT: 'bank_account',
  TAX_ID: 'tax_id',
  AGE: 'age'
};

export const PII_REPLACEMENTS = {
  [PII_TYPES.EMAIL]: '[email redacted]',
  [PII_TYPES.PHONE]: '[phone redacted]',
  [PII_TYPES.URL]: '[URL redacted]',
  [PII_TYPES.NAME]: 'Candidate',
  [PII_TYPES.ADDRESS]: '[address redacted]',
  [PII_TYPES.SSN]: '[SSN redacted]',
  [PII_TYPES.CREDIT_CARD]: '[card redacted]',
  [PII_TYPES.DATE_OF_BIRTH]: '[DOB redacted]',
  [PII_TYPES.PASSPORT]: '[passport redacted]',
  [PII_TYPES.IP_ADDRESS]: '[IP redacted]',
  [PII_TYPES.BANK_ACCOUNT]: '[account redacted]',
  [PII_TYPES.TAX_ID]: '[tax ID redacted]',
  [PII_TYPES.AGE]: '[age redacted]'
};

// Color coding for PII highlighting
export const PII_COLORS = {
  [PII_TYPES.EMAIL]: 'bg-blue-200 dark:bg-blue-900/50 border-b-2 border-blue-400 dark:border-blue-600',
  [PII_TYPES.PHONE]: 'bg-green-200 dark:bg-green-900/50 border-b-2 border-green-400 dark:border-green-600',
  [PII_TYPES.URL]: 'bg-purple-200 dark:bg-purple-900/50 border-b-2 border-purple-400 dark:border-purple-600',
  [PII_TYPES.NAME]: 'bg-red-200 dark:bg-red-900/50 border-b-2 border-red-400 dark:border-red-600',
  [PII_TYPES.ADDRESS]: 'bg-orange-200 dark:bg-orange-900/50 border-b-2 border-orange-400 dark:border-orange-600',
  [PII_TYPES.SSN]: 'bg-yellow-200 dark:bg-yellow-900/50 border-b-2 border-yellow-400 dark:border-yellow-600',
  [PII_TYPES.CREDIT_CARD]: 'bg-pink-200 dark:bg-pink-900/50 border-b-2 border-pink-400 dark:border-pink-600',
  [PII_TYPES.DATE_OF_BIRTH]: 'bg-indigo-200 dark:bg-indigo-900/50 border-b-2 border-indigo-400 dark:border-indigo-600',
  [PII_TYPES.PASSPORT]: 'bg-cyan-200 dark:bg-cyan-900/50 border-b-2 border-cyan-400 dark:border-cyan-600',
  [PII_TYPES.IP_ADDRESS]: 'bg-teal-200 dark:bg-teal-900/50 border-b-2 border-teal-400 dark:border-teal-600',
  [PII_TYPES.BANK_ACCOUNT]: 'bg-rose-200 dark:bg-rose-900/50 border-b-2 border-rose-400 dark:border-rose-600',
  [PII_TYPES.TAX_ID]: 'bg-amber-200 dark:bg-amber-900/50 border-b-2 border-amber-400 dark:border-amber-600',
  [PII_TYPES.AGE]: 'bg-lime-200 dark:bg-lime-900/50 border-b-2 border-lime-400 dark:border-lime-600'
};

// Enhanced regex patterns per spec
const PATTERNS = {
  // Email: comprehensive pattern matching all common formats
  [PII_TYPES.EMAIL]: /\b[a-zA-Z0-9][a-zA-Z0-9._%+-]{0,63}@[a-zA-Z0-9][a-zA-Z0-9.-]{0,253}\.[a-zA-Z]{2,}\b/gi,
  
  // Phone: Multiple international formats (simplified to prevent ReDoS)
  // Matches: 10-digit (India), US formats, +country code, with/without separators
  [PII_TYPES.PHONE]: /\+?\d{1,4}[\s.-]?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b|\b\d{10,14}\b|\b\(\d{3}\)[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  
  // URLs: Comprehensive - http(s), www, domain.com, social media profiles
  [PII_TYPES.URL]: /(https?:\/\/[^\s,)]+)|(www\.[^\s,)]+)|([a-z0-9-]+\.(com|org|net|io|dev|app|in|co\.in)\/[^\s,)]+)|((linkedin|github|twitter|facebook|instagram|medium|behance)\.com\/[^\s,)]+)|(\b[a-z0-9-]+\.(com|org|net|io|dev|app)\b)/gi,
  
  // Addresses: Indian and US street patterns
  [PII_TYPES.ADDRESS]: /\b\d+[-/,]?\s*[A-Z][a-z]+(\s+[A-Z][a-z]+){0,3}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Way|Place|Pl|Parkway|Pkwy|Nagar|Colony|Extension|Ext|Cross|Main)\b/gi,
  
  // SSN: US Social Security Numbers - require keyword context to avoid false positives
  // Matches: "SSN: 123-45-6789", "Social Security: 123 45 6789", "SSN 123456789"
  [PII_TYPES.SSN]: /\b(SSN|Social Security|Social Security Number|SS#)\s*:?\s*(?!000|666|9\d{2})\d{3}[-\s]?(?!00)\d{2}[-\s]?(?!0000)\d{4}\b/gi,
  
  // Credit Cards: Visa, MasterCard, Amex, Discover (with/without spaces/dashes)
  [PII_TYPES.CREDIT_CARD]: /\b(?:4\d{3}|5[1-5]\d{2}|6011|3[47]\d{2})[-\s]?\d{4,6}[-\s]?\d{4,5}[-\s]?\d{3,4}\b/g,
  
  // Date of Birth: Multiple formats (MM/DD/YYYY, DD-MM-YYYY, Month DD, YYYY, etc.)
  // Also catches "DOB:", "Born:", "Birth Date:", "Birthday:"
  [PII_TYPES.DATE_OF_BIRTH]: /\b(DOB|Date of Birth|Born|Birth Date|Birthday)\s*:?\s*\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b|\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b|\b\d{1,2}[-/](0?[1-9]|1[0-2])[-/](19|20)\d{2}\b/gi,
  
  // Passport: Various country formats - require keyword for ambiguous short formats
  [PII_TYPES.PASSPORT]: /\b(Passport|Passport No|Passport Number)\s*:?\s*[A-Z]{1,2}[0-9]{6,9}\b/gi,
  
  // IP Address: IPv4 and IPv6
  [PII_TYPES.IP_ADDRESS]: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b|\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,
  
  // Bank Account: Various formats (Indian: 9-18 digits, US: 4-17 digits, IBAN)
  [PII_TYPES.BANK_ACCOUNT]: /\b(Account|Account No|Account Number|A\/C|IBAN)\s*:?\s*[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b|\b(Account|Account No|Account Number|A\/C)\s*:?\s*\d{9,18}\b/gi,
  
  // Tax ID: EIN, TIN, PAN (India), Aadhaar (India) - require keyword prefix for numeric-only formats
  [PII_TYPES.TAX_ID]: /\b(EIN|Tax ID|TIN)\s*:?\s*\d{2}[-\s]?\d{7}\b|\b[A-Z]{5}\d{4}[A-Z]\b|\b(Aadhaar|Aadhar|UID)\s*:?\s*\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/gi,
  
  // Age: Explicit age mentions (Age: 25, 25 years old, etc.)
  [PII_TYPES.AGE]: /\b(Age|age)\s*:?\s*\d{1,3}\b|\b\d{1,3}\s+years?\s+old\b/gi
};

// Blacklist of common resume section headers and non-name phrases
const NAME_BLACKLIST = [
  'Work Experience', 'Professional Experience', 'Work History', 'Employment History',
  'Education', 'Academic Background', 'Educational Background',
  'Skills', 'Technical Skills', 'Core Skills', 'Key Skills', 'Core Competencies',
  'Projects', 'Key Projects', 'Major Projects', 'Personal Projects', 'Client Projects', 'Source Projects',
  'Certifications', 'Certificates', 'Professional Certifications',
  'Awards', 'Achievements', 'Honors', 'Accomplishments',
  'References', 'Professional References',
  'Summary', 'Professional Summary', 'Career Summary', 'Executive Summary',
  'Objective', 'Career Objective', 'Professional Objective',
  'Profile', 'Professional Profile', 'Personal Profile',
  'Languages', 'Language Skills',
  'Interests', 'Personal Interests', 'Hobbies',
  'Publications', 'Research Publications',
  'Contact Information', 'Personal Information',
  'Tools', 'Technologies', 'Frameworks',
  'Programming Languages', 'Software Skills',
  'Current Year', 'Batch',
  // Technical terms that appear in resumes
  'Robotic Process', 'Process Automation', 'Machine Learning', 'Data Science',
  'Software Engineer', 'Software Development', 'Web Development',
  'Project Manager', 'Business Analyst', 'Quality Assurance',
  'Database Administrator', 'System Administrator', 'Network Engineer',
  'Cloud Computing', 'Artificial Intelligence', 'Deep Learning',
  'Version Control', 'Source Code', 'Code Review',
  'Unit Testing', 'Integration Testing', 'User Interface',
  'User Experience', 'Product Management', 'Agile Development'
];

// Blacklist for partial word detection - words that should not be detected as names
const PARTIAL_WORD_BLACKLIST = [
  // Technology & Systems
  'GENERATOR', 'AUTOMATION', 'ROBOTIC', 'PROCESS', 'MACHINE', 'SYSTEM',
  'NETWORK', 'DATABASE', 'SOFTWARE', 'HARDWARE', 'FRAMEWORK', 'PLATFORM',
  'APPLICATION', 'SOLUTION', 'SERVICE', 'PRODUCT', 'PROJECT', 'PROGRAM',
  'MODULE', 'COMPONENT', 'INTERFACE', 'ARCHITECTURE', 'INFRASTRUCTURE',
  'TECHNOLOGY', 'TECHNOLOGIES', 'DIGITAL', 'CLOUD', 'SERVER', 'CLIENT',
  'BACKEND', 'FRONTEND', 'FULLSTACK', 'MOBILE', 'DESKTOP', 'WEB',
  'API', 'REST', 'GRAPHQL', 'MICROSERVICE', 'CONTAINER', 'DOCKER',
  'KUBERNETES', 'JENKINS', 'PIPELINE', 'DEPLOYMENT', 'INTEGRATION',
  
  // Job Titles & Roles
  'DEVELOPMENT', 'ENGINEER', 'ANALYST', 'MANAGER', 'ADMINISTRATOR',
  'DEVELOPER', 'DESIGNER', 'ARCHITECT', 'CONSULTANT', 'SPECIALIST',
  'COORDINATOR', 'EXECUTIVE', 'DIRECTOR', 'OFFICER', 'LEAD', 'HEAD',
  'ASSOCIATE', 'ASSISTANT', 'INTERN', 'TRAINEE', 'SENIOR', 'JUNIOR',
  'PRINCIPAL', 'STAFF', 'TEAM', 'MEMBER', 'CONTRIBUTOR', 'OWNER',
  
  // Technical Skills
  'PROGRAMMING', 'CODING', 'SCRIPTING', 'TESTING', 'DEBUGGING',
  'OPTIMIZATION', 'PERFORMANCE', 'SECURITY', 'ENCRYPTION', 'AUTHENTICATION',
  'AUTHORIZATION', 'MONITORING', 'LOGGING', 'ANALYTICS', 'REPORTING',
  'DOCUMENTATION', 'MAINTENANCE', 'SUPPORT', 'TROUBLESHOOTING',
  'CONFIGURATION', 'INSTALLATION', 'MIGRATION', 'UPGRADE', 'PATCH',
  
  // Development Concepts
  'ALGORITHM', 'STRUCTURE', 'PATTERN', 'METHODOLOGY', 'PRACTICE',
  'PRINCIPLE', 'CONCEPT', 'MODEL', 'SCHEMA', 'PROTOCOL', 'STANDARD',
  'SPECIFICATION', 'REQUIREMENT', 'FEATURE', 'FUNCTION', 'METHOD',
  'CLASS', 'OBJECT', 'VARIABLE', 'CONSTANT', 'PARAMETER', 'ARGUMENT',
  
  // Tools & Platforms
  'GITHUB', 'GITLAB', 'BITBUCKET', 'JIRA', 'CONFLUENCE', 'SLACK',
  'VISUAL', 'STUDIO', 'ECLIPSE', 'INTELLIJ', 'PYCHARM', 'VSCODE',
  'POSTMAN', 'SWAGGER', 'ANSIBLE', 'TERRAFORM', 'VAGRANT',
  
  // Languages & Frameworks (common acronyms/names)
  'PYTHON', 'JAVASCRIPT', 'TYPESCRIPT', 'REACT', 'ANGULAR', 'VUE',
  'NODE', 'EXPRESS', 'SPRING', 'DJANGO', 'FLASK', 'LARAVEL',
  'DOTNET', 'CSHARP', 'JAVA', 'KOTLIN', 'SWIFT', 'RUBY', 'PHP',
  'HTML', 'CSS', 'SASS', 'LESS', 'BOOTSTRAP', 'TAILWIND',
  'MYSQL', 'POSTGRESQL', 'MONGODB', 'REDIS', 'ELASTICSEARCH',
  
  // Business & Domains
  'BUSINESS', 'ENTERPRISE', 'CORPORATE', 'COMMERCIAL', 'INDUSTRIAL',
  'FINANCIAL', 'BANKING', 'INSURANCE', 'HEALTHCARE', 'EDUCATION',
  'RETAIL', 'ECOMMERCE', 'LOGISTICS', 'SUPPLY', 'CHAIN', 'MANUFACTURING',
  'SALES', 'MARKETING', 'CUSTOMER', 'OPERATIONS', 'STRATEGIC',
  
  // Methodologies
  'AGILE', 'SCRUM', 'KANBAN', 'WATERFALL', 'DEVOPS', 'CICD',
  'CONTINUOUS', 'ITERATIVE', 'INCREMENTAL', 'LEAN', 'SPRINT',
  
  // Data & Analytics
  'DATA', 'ANALYTICS', 'INTELLIGENCE', 'SCIENCE', 'MINING', 'WAREHOUSE',
  'LAKE', 'PIPELINE', 'ETL', 'TRANSFORM', 'VISUALIZATION', 'DASHBOARD',
  'MACHINE', 'LEARNING', 'ARTIFICIAL', 'NEURAL', 'DEEP', 'MODEL',
  
  // Quality & Testing
  'QUALITY', 'ASSURANCE', 'TESTING', 'AUTOMATION', 'UNIT', 'INTEGRATION',
  'REGRESSION', 'PERFORMANCE', 'LOAD', 'STRESS', 'PENETRATION',
  
  // Common Resume Words
  'EXPERIENCE', 'PROFESSIONAL', 'TECHNICAL', 'CORE', 'KEY', 'MAJOR',
  'PRIMARY', 'SECONDARY', 'RESPONSIBLE', 'MANAGED', 'DEVELOPED',
  'IMPLEMENTED', 'DESIGNED', 'CREATED', 'BUILT', 'DEPLOYED',
  'MAINTAINED', 'IMPROVED', 'OPTIMIZED', 'REDUCED', 'INCREASED',
  'ACHIEVED', 'DELIVERED', 'COMPLETED', 'COLLABORATED', 'COORDINATED',
  'CERTIFICATE', 'CERTIFICATION', 'DEGREE', 'BACHELOR', 'MASTER',
  'DOCTORATE', 'DIPLOMA', 'COURSE', 'TRAINING', 'WORKSHOP', 'SEMINAR',
  // Additional common false positives
  'LEAD', 'INTERN', 'CANDIDATE', 'SKILLS', 'SUMMARY', 'PROFILE',
  'REFERENCES', 'OBJECTIVE', 'AWARDS', 'ACHIEVEMENTS', 'PROJECTS',
  'LANGUAGES', 'TOOLS', 'FRAMEWORKS', 'LIBRARIES', 'PACKAGES',
  'RESPONSIBILITIES', 'ACCOMPLISHMENTS', 'ACTIVITIES', 'CONTRIBUTIONS'
];

// Common first and last names for name detection (capitalized header patterns)
const COMMON_FIRST_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
  'Daniel', 'Matthew', 'Anthony', 'Donald', 'Mark', 'Paul', 'Steven', 'Andrew', 'Kenneth', 'Joshua',
  'Emily', 'Ashley', 'Kimberly', 'Melissa', 'Donna', 'Michelle', 'Dorothy', 'Carol', 'Amanda', 'Betty',
  'Christopher', 'Kevin', 'Brian', 'George', 'Edward', 'Ronald', 'Timothy', 'Jason', 'Jeffrey', 'Ryan',
  'Nicholas', 'Eric', 'Stephen', 'Jacob', 'Benjamin', 'Alexander', 'Jonathan', 'Nathan', 'Samuel', 'Tyler',
  'Brandon', 'Justin', 'Aaron', 'Adam', 'Kyle', 'Sean', 'Logan', 'Austin', 'Dylan', 'Evan',
  'Nicole', 'Samantha', 'Rachel', 'Laura', 'Lauren', 'Brittany', 'Megan', 'Stephanie', 'Katherine', 'Christina',
  'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Abigail', 'Madison', 'Ava', 'Chloe', 'Grace',
  // Indian common names
  'Raj', 'Rahul', 'Amit', 'Priya', 'Neha', 'Vikram', 'Arjun', 'Anjali', 'Rohan', 'Kavya',
  'Aditya', 'Sanjay', 'Deepak', 'Pooja', 'Ravi', 'Krishna', 'Lakshmi', 'Suresh', 'Ramesh', 'Ganesh',
  'Sakthivel', 'Karthik', 'Praveen', 'Divya', 'Shreya', 'Vivek', 'Abhishek', 'Manish', 'Sandeep', 'Harish'
];

const COMMON_LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
  'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
  'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
  'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Baker', 'Nelson', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell',
  'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan',
  'Bell', 'Murphy', 'Bailey', 'Rivera', 'Cooper', 'Richardson', 'Cox', 'Howard', 'Ward', 'Peterson',
  // Indian common surnames
  'Kumar', 'Singh', 'Sharma', 'Patel', 'Reddy', 'Gupta', 'Verma', 'Jain', 'Agarwal', 'Mehta',
  'Iyer', 'Nair', 'Rao', 'Menon', 'Pillai', 'Desai', 'Shah', 'Mukherjee', 'Chatterjee', 'Banerjee',
  'Das', 'Ghosh', 'Joshi', 'Kulkarni', 'Shetty', 'Nambiar', 'Bhat', 'Hegde', 'Krishnan', 'Raman'
];

/**
 * 1. Extract plain text from file or text input
 * @param {File|string} input - File object or text string
 * @returns {Promise<string>} Plain text content
 */
export async function extractTextFromInput(input) {
  // If already a string, return it
  if (typeof input === 'string') {
    return input;
  }
  
  // If it's a File object
  if (input instanceof File) {
    // Validate file size — use dynamic limits from browserCompat (matches Redactor's check)
    const limits = getFileSizeLimits();
    if (input.size > limits.maxFileSize) {
      throw new Error(`File size exceeds ${(limits.maxFileSize / 1024 / 1024).toFixed(0)}MB limit. Current size: ${(input.size / 1024 / 1024).toFixed(2)}MB`);
    }

    const fileType = input.type;
    
    // Handle text files
    if (fileType === 'text/plain' || fileType === '') {
      return await readTextFile(input);
    }
    
    // Handle PDF files
    if (fileType === 'application/pdf') {
      return await extractTextFromPDF(input);
    }
    
    // Handle DOCX files
    if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await extractTextFromDOCX(input);
    }
    
    // Try reading as text anyway
    return await readTextFile(input);
  }
  
  throw new Error('Invalid input type. Expected File or string.');
}

/**
 * Helper: Read text file
 */
function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Helper: Extract text from PDF using pdfjs-dist
 */
async function extractTextFromPDF(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Dynamically import pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source - use CDN compatible with CSP
    // Note: In production, copy worker to public folder for better security
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      // Sort by Y position first (top to bottom), then X position (left to right)
      // This fixes multicolumn layouts
      textContent.items.sort((a, b) => {
        const aY = a.transform[5];
        const bY = b.transform[5];
        const aX = a.transform[4];
        const bX = b.transform[4];
        
        // If on same line (within 5 units), sort by X
        if (Math.abs(bY - aY) <= 5) {
          return aX - bX; // Left to right
        }
        return bY - aY; // Higher Y = top of page
      });
      
      let lastY = null;
      let pageText = '';
      
      // Process items to preserve line breaks
      textContent.items.forEach((item, index) => {
        const currentY = item.transform[5];
        
        // Detect new line by Y position change
        if (lastY !== null && Math.abs(currentY - lastY) > 5) {
          pageText += '\n';
        }
        
        // Add the text
        pageText += item.str;
        
        // Add space if next item is on same line
        if (index < textContent.items.length - 1) {
          const nextItem = textContent.items[index + 1];
          const nextY = nextItem.transform[5];
          if (Math.abs(currentY - nextY) <= 5) {
            pageText += ' ';
          }
        }
        
        lastY = currentY;
      });
      
      fullText += pageText + '\n\n';
    }
    
    return fullText.trim();
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF: ' + error.message);
  }
}

/**
 * Helper: Extract text from DOCX using mammoth
 */
async function extractTextFromDOCX(file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Dynamically import mammoth
    const mammoth = await import('mammoth');
    
    // Extract raw text while preserving structure
    const result = await mammoth.extractRawText({ arrayBuffer });
    
    if (result.messages && result.messages.length > 0) {
      console.warn('DOCX extraction warnings:', result.messages);
    }
    
    return result.value;
  } catch (error) {
    throw new Error('Failed to extract text from DOCX: ' + error.message);
  }
}

/**
 * Helper function to execute regex with timeout protection
 * @param {RegExp} regex - Regular expression to execute
 * @param {string} text - Text to search in
 * @param {number} timeoutMs - Timeout in milliseconds (default 1000ms)
 * @returns {Array} Array of regex matches
 */
function safeRegexExec(regex, text, timeoutMs = 1000) {
  const matches = [];
  const startTime = Date.now();
  let match;
  
  try {
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      // Check for timeout
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`Regex timeout for pattern: ${regex.source}`);
        break;
      }
      matches.push(match);
      
      // Prevent infinite loop on zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  } catch (error) {
    console.error('Regex execution error:', error);
  }
  
  return matches;
}

/**
 * 2. Detect PII in text using regex patterns
 * @param {string} text - Text to analyze
 * @param {Array} customRules - Optional custom regex rules to apply
 * @returns {Array} Array of detected PII objects with format:
 *   {type, match, start, end, suggested, id, confidence}
 */
export function detectPII(text, customRules = []) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return [];
  }
  
  const detections = [];
  let idCounter = 0;
  
  // Detect pattern-based PII (email, phone, URL, address)
  Object.entries(PATTERNS).forEach(([type, pattern]) => {
    const regex = new RegExp(pattern);
    const matches = safeRegexExec(regex, text);
    
    matches.forEach((match) => {
      detections.push({
        id: `pii-${idCounter++}`,
        type,
        value: match[0],  // Use 'value' instead of 'match'
        start: match.index,
        end: match.index + match[0].length,
        suggested: PII_REPLACEMENTS[type],
        confidence: 1.0,
        redact: true // Use 'redact' for consistency with UI
      });
    });
  });
  
  // Detect names (capitalized header words)
  const nameDetections = detectNames(text);
  nameDetections.forEach(detection => {
    detections.push({
      id: `pii-${idCounter++}`,
      ...detection,
      value: detection.match || detection.value, // Ensure 'value' field
      suggested: PII_REPLACEMENTS[PII_TYPES.NAME],
      redact: true
    });
  });
  
  // Apply custom rules if provided
  if (customRules && customRules.length > 0) {
    customRules.forEach(rule => {
      if (!rule.enabled) return;
      
      try {
        const regex = new RegExp(rule.pattern, 'g');
        let match;
        
        while ((match = regex.exec(text)) !== null) {
          detections.push({
            id: `pii-${idCounter++}`,
            type: 'CUSTOM',
            customType: rule.name,
            value: match[0],  // Use 'value' instead of 'match'
            start: match.index,
            end: match.index + match[0].length,
            suggested: rule.replacement || '[REDACTED]',
            confidence: 1.0,
            redact: true
          });
        }
      } catch (e) {
        console.warn(`Invalid custom rule pattern: ${rule.name}`, e);
      }
    });
  }
  
  // Sort by position in text
  detections.sort((a, b) => a.start - b.start);
  
  // Remove duplicates (same position and value)
  const uniqueDetections = [];
  const seen = new Set();
  
  detections.forEach(detection => {
    const key = `${detection.start}-${detection.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueDetections.push(detection);
    }
  });
  
  return uniqueDetections;
}

/**
 * Detect names using capitalized header word patterns and common name database
 */
function detectNames(text) {
  const detections = [];
  const lines = text.split('\n');
  
  // Pattern 1: All-caps name at the very beginning (common in resumes)
  // Matches "FIRSTNAME LASTNAME" or "FIRSTNAME L" or "FIRSTNAME MIDDLE LASTNAME" at document start
  const allCapsHeaderPattern = /^\s*([A-Z]{2,}(?:\s+[A-Z]{1,})+)(?:\n|\s{2,}|\r)/;
  const headerMatch = allCapsHeaderPattern.exec(text);
  if (headerMatch) {
    const nameMatch = headerMatch[1].trim();
    const startPos = text.indexOf(nameMatch);
    
    // Validate it's not a technical term - only check if ALL words are in blacklist
    const words = nameMatch.split(/\s+/);
    const allWordsBlacklisted = words.every(word => 
      PARTIAL_WORD_BLACKLIST.some(term => 
        word.toUpperCase() === term || term.includes(word.toUpperCase())
      )
    );
    
    if (!allWordsBlacklisted) {
      detections.push({
        type: PII_TYPES.NAME,
        match: nameMatch,
        start: startPos,
        end: startPos + nameMatch.length,
        confidence: 0.98
      });
    }
  }
  
  // Pattern 1.5: Name with single letter initial (e.g., "SAKTHIVEL E", "John D", "Mary K")
  // Enhanced with word boundary validation to prevent partial word matches
  const nameWithInitialPattern = /\b([A-Z][a-z]{2,}|[A-Z]{3,})\s+[A-Z]\b/g;
  let initialMatch;
  while ((initialMatch = nameWithInitialPattern.exec(text)) !== null) {
    // Only match in first 300 characters (header area)
    if (initialMatch.index < 300) {
      const firstWord = initialMatch[1];
      const fullMatch = initialMatch[0];
      
      // Check if the first word is a blacklisted technical term
      const isBlacklistedWord = PARTIAL_WORD_BLACKLIST.some(term => 
        firstWord.toUpperCase() === term || firstWord.toUpperCase().includes(term) || term.includes(firstWord.toUpperCase())
      );
      
      if (isBlacklistedWord) {
        continue; // Skip blacklisted technical terms
      }
      
      // Validate that it's a complete word (not part of a larger word)
      // Check character before match (should be whitespace or start of text)
      const charBefore = initialMatch.index > 0 ? text[initialMatch.index - 1] : '\n';
      const charAfter = initialMatch.index + fullMatch.length < text.length ? text[initialMatch.index + fullMatch.length] : '\n';
      const isCompleteWord = (/[\s\n]/.test(charBefore) || initialMatch.index === 0) && 
                            (/[\s\n,.]/.test(charAfter) || initialMatch.index + fullMatch.length === text.length);
      
      if (!isCompleteWord) {
        continue; // Skip if it's part of a larger word
      }
      
      // Additional check: reject if first word is all uppercase and longer than 8 chars (likely acronym/technical term)
      if (firstWord === firstWord.toUpperCase() && firstWord.length > 8) {
        continue;
      }
      
      // Reject patterns that look like partial technical terms
      const textAround = text.substring(Math.max(0, initialMatch.index - 15), Math.min(text.length, initialMatch.index + fullMatch.length + 15));
      const hasTechnicalContext = /\b(AUTOMATION|ROBOTIC|PROCESS|MACHINE|SYSTEM|ENGINEER|SOFTWARE|DEVELOPER)\b/i.test(textAround);
      if (hasTechnicalContext) {
        continue;
      }
      
      const isDuplicate = detections.some(d => 
        (initialMatch.index >= d.start && initialMatch.index < d.end) ||
        (initialMatch.index + initialMatch[0].length > d.start && initialMatch.index + initialMatch[0].length <= d.end)
      );
      
      if (!isDuplicate) {
        detections.push({
          type: PII_TYPES.NAME,
          match: initialMatch[0],
          start: initialMatch.index,
          end: initialMatch.index + initialMatch[0].length,
          confidence: 0.92
        });
      }
    }
  }
  
  // Pattern 2: Common first name + last name combinations
  COMMON_FIRST_NAMES.forEach(firstName => {
    COMMON_LAST_NAMES.forEach(lastName => {
      const fullName = `${firstName} ${lastName}`;
      const regex = new RegExp(`\\b${firstName}\\s+${lastName}\\b`, 'gi');
      let match;
      
      while ((match = regex.exec(text)) !== null) {
        // Avoid duplicates with Pattern 1
        const isDuplicate = detections.some(d => 
          (match.index >= d.start && match.index < d.end) ||
          (match.index + match[0].length > d.start && match.index + match[0].length <= d.end)
        );
        
        if (!isDuplicate) {
          detections.push({
            type: PII_TYPES.NAME,
            match: match[0],
            start: match.index,
            end: match.index + match[0].length,
            confidence: 0.95
          });
        }
      }
    });
  });
  
  // Pattern 3: Capitalized words at start of document (likely name in header)
  // Match pattern: "FirstName LastName" at the beginning or after newline
  const headerPattern = /(?:^|\n)([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)(?:\n|$|\s{2,})/g;
  let match;
  
  while ((match = headerPattern.exec(text)) !== null) {
    const nameMatch = match[1].trim();
    const actualStart = match.index + (match[0].startsWith('\n') ? 1 : 0);
    
    // Check if it's in the blacklist (case-insensitive)
    const isBlacklisted = NAME_BLACKLIST.some(term => 
      term.toLowerCase() === nameMatch.toLowerCase()
    );
    
    if (isBlacklisted) {
      continue; // Skip blacklisted terms
    }
    
    // Check if any word in the name is a technical term
    const words = nameMatch.split(/\s+/);
    const hasTechnicalWord = words.some(word => 
      PARTIAL_WORD_BLACKLIST.some(term => 
        word.toUpperCase() === term || word.toUpperCase().includes(term) || term.includes(word.toUpperCase())
      )
    );
    
    if (hasTechnicalWord) {
      continue;
    }
    
    // Avoid duplicates
    const isDuplicate = detections.some(d => 
      (actualStart >= d.start && actualStart < d.end) ||
      (d.start >= actualStart && d.start < actualStart + nameMatch.length) ||
      Math.abs(d.start - actualStart) < 5
    );
    
    if (!isDuplicate && match.index < 500) { // Only in first 500 chars
      detections.push({
        type: PII_TYPES.NAME,
        match: nameMatch,
        start: actualStart,
        end: actualStart + nameMatch.length,
        confidence: 0.85
      });
    }
  }
  
  // Pattern 4: Single common first names near the top (first 200 chars)
  if (text.length > 0) {
    const headerText = text.substring(0, Math.min(200, text.length));
    COMMON_FIRST_NAMES.forEach(name => {
      const regex = new RegExp(`\\b${name}\\b`, 'g');
      let match;
      
      while ((match = regex.exec(headerText)) !== null) {
        // Only if it's on its own line or at start
        const charBefore = match.index > 0 ? headerText[match.index - 1] : '\n';
        const charAfter = match.index + name.length < headerText.length 
          ? headerText[match.index + name.length] 
          : '\n';
        
        if ((charBefore === '\n' || charBefore === '\r') && 
            (charAfter === '\n' || charAfter === '\r' || charAfter === ' ')) {
          detections.push({
            type: PII_TYPES.NAME,
            match: name,
            start: match.index,
            end: match.index + name.length,
            confidence: 0.7
          });
        }
      }
    });
  }
  
  return detections;
}

/**
 * 3. Replace PII in text based on user-confirmed selections
 * @param {string} text - Original text
 * @param {Array} selections - Array of PII detections with 'redact' flag
 * @returns {string} Anonymized text with replacements
 */
export function replacePII(text, selections) {
  if (!text || !selections || selections.length === 0) {
    return text;
  }
  
  // Filter only redacted items and sort by position (reverse order)
  const acceptedItems = selections
    .filter(item => item.redact === true)
    .sort((a, b) => b.start - a.start);
  
  let result = text;
  
  // Replace from end to start to maintain string positions
  acceptedItems.forEach(item => {
    result = 
      result.substring(0, item.start) +
      item.suggested +
      result.substring(item.end);
  });
  
  return result;
}

/**
 * 4. Highlight PII in text with HTML mark tags for preview
 * @param {string} text - Original text
 * @param {Array} matches - Array of PII detections
 * @returns {string} HTML string with <mark> tags colored by type
 */
export function highlightPII(text, matches) {
  if (!text || !matches || matches.length === 0) {
    // Return plain text escaped for HTML
    return escapeHtml(text);
  }
  
  const sortedMatches = [...matches].sort((a, b) => a.start - b.start);
  const parts = [];
  let lastIndex = 0;
  
  sortedMatches.forEach((pii, index) => {
    // Add text before PII (escaped)
    if (pii.start > lastIndex) {
      parts.push(escapeHtml(text.substring(lastIndex, pii.start)));
    }
    
    // Add highlighted PII with color coding
    const colorClass = pii.redact 
      ? PII_COLORS[pii.type] || 'bg-gray-200 dark:bg-gray-700'
      : 'bg-gray-200 dark:bg-gray-700 line-through opacity-50';
    
    const title = `${pii.type}: ${pii.redact ? 'Will be redacted' : 'Ignored'} → ${pii.suggested}`;
    
    parts.push(
      `<mark class="${colorClass} px-1 rounded cursor-pointer transition-colors" title="${escapeHtml(title)}" data-pii-id="${pii.id}">${escapeHtml(text.substring(pii.start, pii.end))}</mark>`
    );
    
    lastIndex = pii.end;
  });
  
  // Add remaining text (escaped)
  if (lastIndex < text.length) {
    parts.push(escapeHtml(text.substring(lastIndex)));
  }
  
  // SECURITY FIX: Sanitize final HTML to prevent XSS attacks
  const html = parts.join('');
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: ['class', 'title', 'data-pii-id'],
    KEEP_CONTENT: true
  });
}

/**
 * Helper: Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get statistics about detected PII
 */
export function getPIIStats(piiItems) {
  const stats = {
    total: piiItems.length,
    accepted: piiItems.filter(item => item.redact).length,
    byType: {}
  };
  
  Object.values(PII_TYPES).forEach(type => {
    stats.byType[type] = piiItems.filter(item => item.type === type).length;
  });
  
  return stats;
}


