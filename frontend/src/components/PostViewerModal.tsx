import { useState } from 'react';
import { likePost, deletePost } from '../api';
import { hapticImpact, hapticSuccess } from '../utils/haptics';
import { useSheetSwipe } from '../utils/useSheetSwipe';
import PostCard from './PostCard';
import CommentsSheet from './CommentsSheet';
import type { Post } from '../types';

interface Props {
  post: Post;
  currentUserId: number | null;
  onClose: () => void;
  onViewUser?: (id: number) => void;
  onChange?: (post: Post) => void;
  onDeleted?: (id: number) => void;
}

export default function PostViewerModal({ post, currentUserId, onClose, onViewUser, onChange, onDeleted }: Props) {
  const [local, setLocal] = useState<Post>(post);
  const [showComments, setShowComments] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const swipe = useSheetSwipe(onClose);

  const isOwner = currentUserId !== null && post.user_id === currentUserId;

  const handleLike = async (p: Post) => {
    hapticImpact('light');
    const optimistic: Post = { ...local, liked_by_me: !p.liked_by_me, likes_count: p.likes_count + (p.liked_by_me ? -1 : 1) };
    setLocal(optimistic);
    onChange?.(optimistic);
    try {
      const r = await likePost(p.id);
      const updated = { ...optimistic, liked_by_me: r.liked, likes_count: r.likes_count };
      setLocal(updated);
      onChange?.(updated);
    } catch {
      setLocal(p);
      onChange?.(p);
    }
  };

  const handleDelete = async () => {
    setConfirmDelete(false);
    try {
      await deletePost(local.id);
      hapticSuccess();
      onDeleted?.(local.id);
      onClose();
    } catch { /* ignore */ }
  };

  return (
    <>
      <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-sheet post-viewer" ref={swipe.sheetRef}
          onTouchStart={swipe.handleTouchStart}
          onTouchMove={swipe.handleTouchMove}
          onTouchEnd={swipe.handleTouchEnd}>
          <div className="modal-sheet__handle" />
          <div className="modal-sheet__header">
            <button className="modal-sheet__close-btn" onClick={onClose}>Закрыть</button>
            <span className="modal-sheet__title">Пост</span>
            <div style={{ width: 60 }} />
          </div>
          <div className="post-viewer__scroll">
            <PostCard
              post={local}
              isOwner={isOwner}
              onViewUser={id => { onClose(); onViewUser?.(id); }}
              onLike={handleLike}
              onComments={() => setShowComments(true)}
              onAskDelete={() => setConfirmDelete(true)}
            />
          </div>
        </div>
      </div>

      {showComments && (
        <CommentsSheet
          postId={local.id}
          currentUserId={currentUserId}
          onClose={() => setShowComments(false)}
          onPosted={() => {
            const updated = { ...local, comments_count: local.comments_count + 1 };
            setLocal(updated); onChange?.(updated);
          }}
          onDeleted={() => {
            const updated = { ...local, comments_count: Math.max(0, local.comments_count - 1) };
            setLocal(updated); onChange?.(updated);
          }}
        />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(false)}>
          <div className="feed__confirm" onClick={e => e.stopPropagation()}>
            <h3>Удалить пост?</h3>
            <p>Это действие нельзя отменить</p>
            <div className="feed__confirm-actions">
              <button className="feed__confirm-cancel" onClick={() => setConfirmDelete(false)}>Отмена</button>
              <button className="feed__confirm-delete" onClick={handleDelete}>Удалить</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
