export default function DbError({ message }: { message: string }) {
  const missingTables = /does not exist|schema cache|Could not find the table/i.test(message);
  return (
    <div className="card space-y-2">
      <h2 className="font-semibold text-red-700">Couldn&apos;t load data from Supabase</h2>
      <p className="text-sm text-gray-700">{message}</p>
      {missingTables && (
        <p className="text-sm text-gray-700">
          The database tables haven&apos;t been created yet. In Supabase, open SQL Editor → New query, paste the
          contents of <code>supabase/schema.sql</code>, click Run, then reload this page.
        </p>
      )}
    </div>
  );
}
