import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { FaFilePdf, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

// تهيئة Supabase Client للعمليات من جانب الخادم (يستخدم Service Role للقراءة الآمنة)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// دالة لجلب البيانات والتحقق من التوكن
async function getData(token: string) {
  // 1. البحث عن الرابط والتحقق من الصلاحية
  const { data: linkData, error } = await supabase
    .from('access_links')
    .select(`
      *,
      documents (
        summary_text,
        file_path,
        categories (name_ar)
      )
    `)
    .eq('token', token)
    .gt('expires_at', new Date().toISOString()) // التحقق من التاريخ
    .single();

  if (error || !linkData) return null;

  // 2. توليد رابط موقع للملف (صالح لمدة 15 دقيقة فقط)
  const { data: fileData } = await supabase
    .storage
    .from('documents_bucket')
    .createSignedUrl(linkData.documents.file_path, 60 * 15);

  return {
    summary: linkData.documents.summary_text,
    category: linkData.documents.categories.name_ar,
    pdfUrl: fileData?.signedUrl,
  };
}

export default async function DocumentPage({ params }: { params: { token: string } }) {
  // بما أن Next.js 15 يتعامل مع params كـ Promise في بعض الحالات، ننتظرها
  const { token } = await params;
  const data = await getData(token);

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-gray-800 dir-rtl">
        <FaExclamationTriangle className="text-5xl text-red-500 mb-4" />
        <h1 className="text-2xl font-bold">الرابط غير صالح أو منتهي الصلاحية</h1>
        <p className="mt-2 text-gray-600">يرجى طلب رابط جديد.</p>
      </div>
    );
  }

  return (
    <main dir="rtl" className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-2 rounded-lg">
              <FaFilePdf size={20} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight">عرض المستند</h1>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {data.category}
              </span>
            </div>
          </div>
          <div className="flex items-center text-green-600 text-sm font-medium">
            <FaCheckCircle className="ml-1" />
            <span>آمن ومشفر</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 md:p-6 grid gap-6">
        
        {/* قسم الملخص الذكي */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-l from-blue-50 to-white px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-blue-900 flex items-center gap-2">
              ✨ ملخص الذكاء الاصطناعي
            </h2>
          </div>
          <div 
            className="p-6 text-gray-700 leading-relaxed text-lg prose prose-blue max-w-none"
            dangerouslySetInnerHTML={{ __html: data.summary || 'جاري المعالجة...' }} 
          />
        </section>

        {/* عارض ملف PDF */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-1 h-[800px] relative">
           {data.pdfUrl ? (
             <iframe 
               src={`${data.pdfUrl}#toolbar=0`} 
               className="w-full h-full rounded-xl"
               title="PDF Viewer"
             />
           ) : (
             <div className="flex items-center justify-center h-full text-gray-400">
               لا يمكن تحميل الملف حالياً
             </div>
           )}
           
           {/* طبقة حماية إضافية تمنع النقر بزر الماوس الأيمن (UX Security) */}
           <div className="absolute inset-0 bg-transparent" onContextMenu={(e) => e.preventDefault()} style={{ pointerEvents: 'none' }} />
        </section>
        
        <footer className="text-center text-gray-400 text-sm py-6">
          جميع الحقوق محفوظة © {new Date().getFullYear()} - منصة المستندات الذكية
        </footer>

      </div>
    </main>
  );
}