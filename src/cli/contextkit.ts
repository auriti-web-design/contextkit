/**
 * Kiro Memory CLI - Command line interface
 * (shebang aggiunto automaticamente dal build)
 */

import { createContextKit } from '../sdk/index.js';

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  const contextkit = createContextKit();

  try {
    switch (command) {
      case 'context':
      case 'ctx':
        await showContext(contextkit);
        break;
      
      case 'search':
        await searchContext(contextkit, args[1]);
        break;
      
      case 'observations':
      case 'obs':
        await showObservations(contextkit, parseInt(args[1]) || 10);
        break;
      
      case 'summaries':
      case 'sum':
        await showSummaries(contextkit, parseInt(args[1]) || 5);
        break;
      
      case 'add-observation':
      case 'add-obs':
        await addObservation(contextkit, args[1], args.slice(2).join(' '));
        break;
      
      case 'add-summary':
      case 'add-sum':
        await addSummary(contextkit, args.slice(1).join(' '));
        break;
      
      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;
      
      default:
        console.log('ContextKit CLI\n');
        showHelp();
        process.exit(1);
    }
  } finally {
    contextkit.close();
  }
}

async function showContext(contextkit: ReturnType<typeof createContextKit>) {
  const context = await contextkit.getContext();
  
  console.log(`\n📁 Project: ${context.project}\n`);
  
  console.log('📝 Recent Observations:');
  context.relevantObservations.slice(0, 5).forEach((obs, i) => {
    console.log(`  ${i + 1}. ${obs.title} (${new Date(obs.created_at).toLocaleDateString()})`);
    if (obs.text) {
      console.log(`     ${obs.text.substring(0, 100)}${obs.text.length > 100 ? '...' : ''}`);
    }
  });
  
  console.log('\n📊 Recent Summaries:');
  context.relevantSummaries.slice(0, 3).forEach((sum, i) => {
    console.log(`  ${i + 1}. ${sum.request || 'No request'} (${new Date(sum.created_at).toLocaleDateString()})`);
    if (sum.learned) {
      console.log(`     Learned: ${sum.learned.substring(0, 100)}${sum.learned.length > 100 ? '...' : ''}`);
    }
  });
  
  console.log('');
}

async function searchContext(contextkit: ReturnType<typeof createContextKit>, query: string) {
  if (!query) {
    console.error('Error: Please provide a search query');
    process.exit(1);
  }
  
  const results = await contextkit.search(query);
  
  console.log(`\n🔍 Search results for: "${query}"\n`);
  
  if (results.observations.length > 0) {
    console.log(`📋 Observations (${results.observations.length}):`);
    results.observations.forEach((obs, i) => {
      console.log(`  ${i + 1}. ${obs.title}`);
      if (obs.text) {
        console.log(`     ${obs.text.substring(0, 150)}${obs.text.length > 150 ? '...' : ''}`);
      }
    });
  }
  
  if (results.summaries.length > 0) {
    console.log(`\n📊 Summaries (${results.summaries.length}):`);
    results.summaries.forEach((sum, i) => {
      console.log(`  ${i + 1}. ${sum.request || 'No request'}`);
      if (sum.learned) {
        console.log(`     ${sum.learned.substring(0, 150)}${sum.learned.length > 150 ? '...' : ''}`);
      }
    });
  }
  
  if (results.observations.length === 0 && results.summaries.length === 0) {
    console.log('No results found.\n');
  } else {
    console.log('');
  }
}

async function showObservations(contextkit: ReturnType<typeof createContextKit>, limit: number) {
  const observations = await contextkit.getRecentObservations(limit);
  
  console.log(`\n📋 Last ${limit} Observations:\n`);
  
  observations.forEach((obs, i) => {
    console.log(`${i + 1}. ${obs.title} [${obs.type}]`);
    console.log(`   Date: ${new Date(obs.created_at).toLocaleString()}`);
    if (obs.text) {
      console.log(`   Content: ${obs.text.substring(0, 200)}${obs.text.length > 200 ? '...' : ''}`);
    }
    console.log('');
  });
}

async function showSummaries(contextkit: ReturnType<typeof createContextKit>, limit: number) {
  const summaries = await contextkit.getRecentSummaries(limit);
  
  console.log(`\n📊 Last ${limit} Summaries:\n`);
  
  summaries.forEach((sum, i) => {
    console.log(`${i + 1}. ${sum.request || 'No request'}`);
    console.log(`   Date: ${new Date(sum.created_at).toLocaleString()}`);
    if (sum.learned) {
      console.log(`   Learned: ${sum.learned}`);
    }
    if (sum.completed) {
      console.log(`   Completed: ${sum.completed}`);
    }
    if (sum.next_steps) {
      console.log(`   Next Steps: ${sum.next_steps}`);
    }
    console.log('');
  });
}

async function addObservation(
  contextkit: ReturnType<typeof createContextKit>, 
  title: string, 
  content: string
) {
  if (!title || !content) {
    console.error('Error: Please provide both title and content');
    process.exit(1);
  }
  
  const id = await contextkit.storeObservation({
    type: 'manual',
    title,
    content
  });
  
  console.log(`✅ Observation stored with ID: ${id}\n`);
}

async function addSummary(contextkit: ReturnType<typeof createContextKit>, content: string) {
  if (!content) {
    console.error('Error: Please provide summary content');
    process.exit(1);
  }
  
  const id = await contextkit.storeSummary({
    learned: content
  });
  
  console.log(`✅ Summary stored with ID: ${id}\n`);
}

function showHelp() {
  console.log(`Usage: contextkit <command> [options]

Commands:
  context, ctx              Show current project context
  search <query>            Search across all context
  observations [limit]      Show recent observations (default: 10)
  summaries [limit]         Show recent summaries (default: 5)
  add-observation <title> <content>   Add a new observation
  add-summary <content>     Add a new summary
  help                      Show this help message

Examples:
  contextkit context
  contextkit search "authentication"
  contextkit observations 20
  contextkit add-observation "Bug Fix" "Fixed the login issue"
`);
}

main().catch(console.error);
