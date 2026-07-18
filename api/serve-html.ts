import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Determine base URL to fetch the original index.html
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const baseUrl = `${protocol}://${host}`;

  // Fetch the static index.html from the root
  let html = '';
  try {
    const fetchRes = await fetch(`${baseUrl}/`);
    html = await fetchRes.text();
  } catch (err) {
    console.error("Failed to fetch base index.html", err);
    return res.status(500).send("Internal Server Error");
  }

  // 2. Determine context from query parameters injected by Vercel rewrites
  const urlPath = req.url || '';
  const type = req.query.type as string;
  const eventId = req.query.eventId as string;
  const campaignId = req.query.campaignId as string;
  const orgSlug = req.query.orgSlug as string;
  
  let ogTitle = "Agoroll";
  let ogDescription = "Streamline Rotary event registration and donations with agoroll — a professional platform that connects leaders, supports community projects, and enhances engagement.";
  let ogImage = `${baseUrl}/assets/rotary_gold_logo.png`;

  try {
    if (type === 'event' && eventId) {
      const { data: event } = await supabase.from('events').select('title, description, cover_image_url').eq('id', eventId).single();
      if (event) {
        ogTitle = event.title || ogTitle;
        // Strip HTML tags for the description
        const plainTextDesc = event.description ? event.description.replace(/<[^>]+>/g, '').substring(0, 160) : ogDescription;
        ogDescription = plainTextDesc;
        if (event.cover_image_url) {
          ogImage = event.cover_image_url;
        }
      }
    } else if (type === 'donate') {
      if (campaignId) {
        const { data: campaign } = await supabase.from('donation_campaigns').select('title, description, cover_image_url').eq('id', campaignId).single();
        if (campaign) {
          ogTitle = campaign.title || ogTitle;
          const plainTextDesc = campaign.description ? campaign.description.replace(/<[^>]+>/g, '').substring(0, 160) : "Contribute to this Rotary donation drive.";
          ogDescription = plainTextDesc;
          if (campaign.cover_image_url) {
            ogImage = campaign.cover_image_url;
          }
        }
      } else if (orgSlug) {
        const { data: org } = await supabase.from('organizations').select('name').eq('slug', orgSlug).single();
        if (org) {
          ogTitle = `Donate to ${org.name}`;
          ogDescription = "Support our club projects and community initiatives by making a direct contribution today.";
        }
      }
    }
  } catch (err) {
    console.error("Error fetching OG data from Supabase", err);
    // Continue with default tags
  }

  // 3. Inject the dynamic Open Graph tags into the HTML <head>
  const ogTags = `
    <meta property="og:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
    <meta property="og:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${baseUrl}${urlPath}" />
    
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle.replace(/"/g, '&quot;')}" />
    <meta name="twitter:description" content="${ogDescription.replace(/"/g, '&quot;')}" />
    <meta name="twitter:image" content="${ogImage}" />
  `;

  // Insert before the closing </head> tag
  if (html.includes('</head>')) {
    html = html.replace('</head>', `${ogTags}\n</head>`);
  }

  // Also replace the default <title> tag
  html = html.replace(/<title>.*?<\/title>/, `<title>${ogTitle.replace(/"/g, '&quot;')}</title>`);
  
  // Set headers to act like a standard HTML document
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300'); // Cache at Edge for 60 seconds
  
  res.status(200).send(html);
}
