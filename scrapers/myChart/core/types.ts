


export type RequestConfig = {
  method?: 'POST' | 'GET';


  // Either path or url must be defined.
  // If url is defined, it is used. 
  // If not, origin must be set in the constructor, and https is assumed. 
  url?: string;
  path?: string;


  // String for the JSON APIs; binary (Uint8Array) for multipart uploads
  // (e.g. attachment UploadFile). Both pass through to fetch untouched.
  body?: string | Uint8Array<ArrayBuffer>;
  headers?: Record<string, string>;
  cookies?: Record<string, string>;
  followRedirects?: boolean;
}
