import views from './views.mjs';

export default {
  fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.swampwiki.com') {
      url.protocol = 'https:';
      url.host = 'swampwiki.com';
      url.port = '';
      return Response.redirect(url.href, 308);
    }
    return views.fetch(request, env);
  },
};
